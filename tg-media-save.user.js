// ==UserScript==
// @name         TG Media Save
// @name:ru      TG Media Save — сохранение медиа из Telegram Web
// @namespace    https://github.com/LazyFaiz/tg-media-save
// @version      1.0.4
// @description  Save photos, videos, GIFs and voice messages from Telegram Web — including channels with "restrict saving content" enabled.
// @description:ru  Сохраняйте фото, видео, GIF и голосовые из Telegram Web — в том числе из каналов с запретом сохранения контента.
// @author       Denis Ermilov
// @license      MIT
// @homepage     https://github.com/LazyFaiz/tg-media-save
// @supportURL   https://github.com/LazyFaiz/tg-media-save/issues
// @match        https://web.telegram.org/*
// @match        https://webk.telegram.org/*
// @match        https://webz.telegram.org/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

/*
 * tg-media-save — original code by Denis Ermilov (MIT).
 *
 * Single source of truth for BOTH distribution modes:
 *   - Tampermonkey/Violentmonkey userscript (isolated world, `@grant unsafeWindow`)
 *   - Chrome MV3 extension content script (`"world": "MAIN"`)
 *
 * How it works (the non-obvious parts):
 *  - web.telegram.org has a strict CSP that blocks page-world script injection. Both modes
 *    avoid it: the userscript runs in the isolated world; the extension runs as a
 *    browser-injected MAIN-world content script. Neither is subject to the page CSP.
 *    (On Chrome MV3 the Tampermonkey "Allow user scripts" toggle must also be enabled.)
 *  - Telegram /k/ streams media through its own Service Worker at URLs like
 *    /k/stream/<urlencoded JSON descriptor>. The descriptor holds the real file name, size,
 *    mime type and DC id. To actually receive the bytes, the fetch must run in the PAGE
 *    context (so the Service Worker intercepts it) — that's why every network call goes
 *    through `page.fetch` (unsafeWindow.fetch / window.fetch), not the content-script fetch.
 *  - Media URLs are discovered by polling <video>/<audio> `currentSrc` (the DOM is shared
 *    between worlds, so this works from the isolated world too).
 *  - If Telegram's Service Worker is not serving bytes (e.g. after a network change you'll
 *    see `FetchEvent … rejected` / `ERR_NETWORK_CHANGED` in the console), the page itself
 *    cannot play the file and no userscript/extension can download it — reload / re-login.
 */

(function () {
  "use strict";

  const page = typeof unsafeWindow !== "undefined" && unsafeWindow ? unsafeWindow : window;
  const TAG = "[tg-media-save]";
  const POLL_MS = 600;
  let verbose = false;

  const log = (...a) => {
    if (verbose) console.log(TAG, ...a);
  };
  const info = (...a) => console.info(TAG, ...a);
  const fail = (...a) => console.error(TAG, ...a);

  // ---------- helpers ----------
  const humanSize = (n) => {
    if (!n) return "";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
  };

  const extFromMime = (mime) => {
    const map = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    return map[mime] || (mime ? mime.split("/")[1] : "") || "bin";
  };

  const withExt = (name, mime) => {
    const ext = extFromMime(mime);
    if (!ext) return name;
    return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${ext}`;
  };

  // Parse a Telegram /k/stream/<json> descriptor -> {name,size,mime,dcId} | null
  const describeStream = (url) => {
    try {
      const seg = url.split("/").pop();
      const d = JSON.parse(decodeURIComponent(seg));
      if (d && (d.fileName || d.size)) {
        return { name: d.fileName || null, size: d.size || 0, mime: d.mimeType || null, dcId: d.dcId };
      }
    } catch (_) {
      /* not a stream descriptor */
    }
    return null;
  };

  // WebK overrides video.src to retain hls/<document>, while currentSrc is an
  // unfetchable MediaSource blob. Both hls and stream accept DownloadOptions.
  const fileSource = (value) => {
    if (!value || typeof value !== "string") return null;
    try {
      const url = new page.URL(value, page.location.href);
      if (url.origin !== page.location.origin) return null;
      const match = /^(.*\/)(hls|stream)\/([^/]+)$/.exec(url.pathname);
      if (!match) return null;
      const descriptor = JSON.parse(decodeURIComponent(match[3]));
      if (descriptor.location?._ !== "inputDocumentFileLocation" ||
          !descriptor.location.id || !Number.isSafeInteger(descriptor.size) || descriptor.size <= 0) return null;
      url.pathname = `${match[1]}stream/${match[3]}`;
      return url.href;
    } catch (_) {
      return null;
    }
  };

  // Telegram can revoke a Blob URL after attaching it to a playable video.
  // Keep bounded references to file Blobs, without delaying Telegram's revocation.
  const createBlobCache = (now = Date.now, limit = 512 * 1024 * 1024, ttl = 5 * 60 * 1000) => {
    const entries = new Map();
    let bytes = 0;
    const remove = (url) => {
      bytes -= entries.get(url)?.blob?.size || 0;
      entries.delete(url);
    };
    const prune = () => {
      for (const [url, item] of entries) if (now() - item.time >= ttl) remove(url);
    };
    return {
      put(url, blob) {
        prune();
        remove(url);
        if (blob && blob.size > limit) return;
        entries.set(url, { blob, time: now() });
        bytes += blob?.size || 0;
        while (bytes > limit || entries.size > 32) remove(entries.keys().next().value);
      },
      get(url) { prune(); return entries.get(url); },
      prune,
      status() { prune(); return { entries: entries.size, bytes }; },
    };
  };
  const blobCache = createBlobCache();
  let savingBlob = false;
  let blobCaptureInstalled = false;
  const installBlobCapture = () => {
    if (!page.URL?.createObjectURL || !page.Blob) return;
    const original = page.URL.createObjectURL;
    try {
      page.URL.createObjectURL = function (object) {
        const url = Reflect.apply(original, this, arguments);
        try {
          if (!savingBlob) {
            if (object instanceof page.Blob) blobCache.put(url, object);
            else if ((page.MediaSource && object instanceof page.MediaSource) ||
                     (page.ManagedMediaSource && object instanceof page.ManagedMediaSource)) {
              blobCache.put(url, null);
            }
          }
        } catch (_) { /* Capture must not interfere with playback. */ }
        return url;
      };
      blobCaptureInstalled = page.URL.createObjectURL !== original;
      if (blobCaptureInstalled) setInterval(blobCache.prune, 60000);
    } catch (_) { /* Some userscript environments do not allow page API hooks. */ }
  };
  installBlobCapture();

  // ---------- download engine ----------
  const saveBlob = (blob, name) => {
    let u;
    savingBlob = true;
    try { u = page.URL.createObjectURL(blob); }
    finally { savingBlob = false; }
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => page.URL.revokeObjectURL(u), 30000);
  };

  const CHUNK_SIZE = 1024 * 1024;
  // Retry the body read too: a connection can drop after headers arrive.
  const fetchChunk = async (url, options) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await page.fetch(url, options);
        if (res.status !== 200 && res.status !== 206) {
          const error = new Error(`HTTP ${res.status}`);
          error.retryable = [408, 429, 500, 502, 503, 504].includes(res.status);
          throw error;
        }
        return { res, chunk: await res.blob() };
      } catch (error) {
        const retryable = error && (error.name === "TypeError" || error.retryable);
        if (!retryable || attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  };

  // Download a media URL. Uses the File System Access API when available (real file name +
  // streaming straight to disk), otherwise accumulates Range chunks into an in-memory Blob.
  const download = async (url, onProgress) => {
    url = fileSource(url) || url;
    const meta = describeStream(url);
    const name = (meta && meta.name) || `tg-media-${Date.now()}`;

    // Ordinary Blob and data URLs contain files; MediaSource blobs do not.
    if (/^(blob:|data:)/.test(url)) {
      const captured = blobCache.get(url);
      if (captured && !captured.blob) {
        throw new Error("This video uses MediaSource, not a file Blob. Its original file URL was not found. Run tgSaver.diagnose() for source details.");
      }
      let blob = captured?.blob;
      try {
        if (!blob) ({ chunk: blob } = await fetchChunk(url));
      } catch (error) {
        if (!url.startsWith("blob:")) throw error;
        throw new Error("The blob file is unavailable and was not retained. Reload Telegram after updating the extension, then reopen the video and download within five minutes. Run tgSaver.diagnose() if this continues.", { cause: error });
      }
      const finalName = withExt(name, blob.type);
      saveBlob(blob, finalName);
      return finalName;
    }

    let writable = null;
    if (page.showSaveFilePicker) {
      try {
        const handle = await page.showSaveFilePicker({ suggestedName: withExt(name, meta && meta.mime) });
        writable = await handle.createWritable();
      } catch (err) {
        if (err && err.name === "AbortError") throw err; // user closed the dialog
        writable = null; // fall back to in-memory blob
      }
    }

    const parts = [];
    let offset = 0;
    let total = null;
    let mime = (meta && meta.mime) || "video/mp4";

    try {
      for (;;) {
        const knownSize = total || (meta && meta.size);
        const endRequested = knownSize ? Math.min(offset + CHUNK_SIZE, knownSize) - 1 : offset + CHUNK_SIZE - 1;
        const { res, chunk } = await fetchChunk(url, {
          headers: { Range: `bytes=${offset}-${endRequested}` },
        });
        mime = (res.headers.get("Content-Type") || mime).split(";")[0];

        const range = res.headers.get("Content-Range");

        if (res.status === 200) {
          if (meta && meta.size && chunk.size !== meta.size) {
            throw new Error("Incomplete whole-file response; reopen the media and retry.");
          }
          if (writable && offset) {
            await writable.seek(0);
            await writable.truncate(0);
          }
          // Server ignored Range and sent the whole file at once.
          const finalName = withExt(name, mime);
          if (writable) {
            await writable.write(chunk);
            await writable.close();
            writable = null;
          } else {
            saveBlob(chunk, finalName);
          }
          if (onProgress) onProgress(1);
          return finalName;
        }

        const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range || "");
        if (!m) throw new Error(`Malformed Content-Range header: ${range}`);
        const end = Number(m[2]);
        const nextTotal = Number(m[3]);
        if (![Number(m[1]), end, nextTotal].every(Number.isSafeInteger) ||
            Number(m[1]) !== offset || end < offset || end >= nextTotal ||
            chunk.size !== end - offset + 1 || (total !== null && total !== nextTotal) ||
            (meta && meta.size && meta.size !== nextTotal)) {
          throw new Error("Invalid or incomplete Content-Range response; reopen the media and retry.");
        }
        total = nextTotal;

        if (end + 1 <= offset) throw new Error("Download stalled: server did not advance the offset");

        if (writable) await writable.write(chunk);
        else parts.push(chunk);

        offset = end + 1;
        if (onProgress && total) onProgress(offset / total);
        if (offset >= total) break;
      }

      if (writable) {
        await writable.close();
        writable = null;
      } else {
        saveBlob(new page.Blob(parts, { type: mime }), withExt(name, mime));
      }
      return withExt(name, mime);
    } catch (err) {
      // Release a partially written file so it is not left locked on disk.
      if (writable) await writable.abort().catch(() => {});
      throw err;
    }
  };

  // ---------- capture ----------
  const state = { last: null };

  const mediaUrl = (el) => {
    if (!el) return "";
    const sources = [el.src, el.getAttribute("src"),
      ...Array.from(el.querySelectorAll?.("source[src]") || [], (source) => source.src)];
    for (const source of sources) {
      const file = fileSource(source);
      if (file) return file;
    }
    return el.currentSrc || el.src || "";
  };

  const capture = () => {
    document.querySelectorAll("video, audio").forEach((el) => {
      const url = mediaUrl(el);
      if (!url || url.startsWith("data:")) return;
      if (el.getAttribute("data-tgs-src") !== url) {
        el.setAttribute("data-tgs-src", url);
        state.last = { url, element: el, kind: el.tagName === "AUDIO" ? "audio" : "video", meta: describeStream(url) };
        log("captured", el.tagName, state.last.meta ? state.last.meta.name : url);
        refreshFloating();
      }
    });
  };

  // ---------- UI ----------
  let floatBtn = null;
  let floatCap = null;

  const styles = (el, css) => Object.assign(el.style, css);

  const makeButton = (label, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.setAttribute("aria-label", title);
    return b;
  };

  const refreshFloating = () => {
    if (!floatBtn) return;
    const has = !!state.last;
    styles(floatBtn, {
      cursor: has ? "pointer" : "not-allowed",
      background: has ? "rgba(80,140,190,0.95)" : "rgba(90,90,90,0.5)",
      opacity: has ? "1" : "0.6",
    });
    if (floatCap) {
      const meta = state.last && state.last.meta;
      const text = meta ? `${meta.name || "media"}${meta.size ? " · " + humanSize(meta.size) : ""}` : "";
      floatCap.textContent = text;
      floatCap.style.display = text ? "block" : "none";
    }
  };

  const runDownload = async (url) => {
    if (!url) return;
    info("downloading", url);
    try {
      const name = await download(url, (p) => {
        if (floatCap) floatCap.textContent = `${Math.round(p * 100)}%`;
      });
      info("saved", name);
      if (floatCap) floatCap.textContent = `✅ ${name}`;
      setTimeout(refreshFloating, 2500);
    } catch (err) {
      if (err && err.name === "AbortError") {
        refreshFloating();
        return;
      }
      fail("download failed:", err && err.message ? err.message : err);
      if (err && err.name === "TypeError") {
        info("Network request failed after retries. Reopen the media to refresh its URL. " +
          "If playback also fails, restore the network and reload Telegram. " +
          "Do not enable Service Worker 'Bypass for network'.");
      }
      if (floatCap) {
        floatCap.textContent = `⚠ ${err.message || "Download failed"}`;
        floatCap.title = floatCap.textContent;
        floatCap.style.display = "block";
        setTimeout(refreshFloating, 3000);
      }
    }
  };

  const buildFloating = () => {
    floatBtn = makeButton("⬇", "Save the last loaded media");
    styles(floatBtn, {
      position: "fixed",
      left: "14px",
      bottom: "14px",
      zIndex: "2147483646",
      width: "46px",
      height: "46px",
      borderRadius: "50%",
      border: "none",
      color: "#fff",
      fontSize: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,.4)",
    });
    floatBtn.addEventListener("click", () => {
      if (!state.last) {
        info("nothing captured yet — play a video/audio first");
        return;
      }
      runDownload(mediaUrl(state.last.element) || state.last.url);
    });

    floatCap = document.createElement("div");
    styles(floatCap, {
      position: "fixed",
      left: "14px",
      bottom: "66px",
      zIndex: "2147483646",
      color: "#fff",
      background: "rgba(0,0,0,0.72)",
      padding: "3px 10px",
      borderRadius: "8px",
      fontSize: "11px",
      maxWidth: "280px",
      display: "none",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });

    document.body.appendChild(floatBtn);
    document.body.appendChild(floatCap);
    refreshFloating();
  };

  const INLINE = "tgs-inline-btn";
  const inViewer = (el) => !!el.closest("#MediaViewer, .media-viewer-whole, #StoryViewer, #stories-viewer");

  const attachInline = (host, onClick, title) => {
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const b = makeButton("⬇", title);
    b.className = INLINE;
    styles(b, {
      position: "absolute",
      top: "6px",
      right: "6px",
      zIndex: "40",
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      background: "rgba(0,0,0,0.55)",
      color: "#fff",
      fontSize: "15px",
    });
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    host.appendChild(b);
  };

  const decorate = () => {
    document.querySelectorAll("video, audio").forEach((el) => {
      if (el.offsetWidth < 80 || el.offsetHeight < 80) return;
      const host = el.closest(".media, .bubble, .message") || el.parentElement;
      if (!host || inViewer(host) || host.querySelector("." + INLINE)) return;
      attachInline(
        host,
        () => {
          const url = mediaUrl(el);
          if (url) runDownload(url);
          else info("media not loaded yet — press play, then ⬇");
        },
        "Save this media"
      );
    });

    document.querySelectorAll(".bubble img, .media img, .message img").forEach((im) => {
      if (im.offsetWidth < 120 || im.offsetHeight < 120) return;
      if (inViewer(im)) return;
      const host = im.closest(".media, .bubble, .message") || im.parentElement;
      if (!host || host.querySelector("." + INLINE)) return;
      attachInline(
        host,
        () => {
          const url = im.currentSrc || im.src;
          if (url) runDownload(url);
        },
        "Save this image"
      );
    });
  };

  // ---------- console helpers ----------
  try {
    page.tgSaver = {
      status: () => ({ last: state.last, verbose, blobCaptureInstalled, retained: blobCache.status() }),
      diagnose: () => ({
        version: "1.0.4",
        blobCaptureInstalled,
        retained: blobCache.status(),
        media: Array.from(document.querySelectorAll("video, audio"), (el) => {
          const url = mediaUrl(el);
          const captured = blobCache.get(url);
          return {
            readyState: el.readyState,
            sourceType: url.startsWith("blob:") ? "blob" : fileSource(url) ? "stream" : "other",
            capturedType: !captured ? "not-retained" : captured.blob ? "Blob" : "MediaSource",
            size: captured?.blob?.size || 0,
          };
        }),
      }),
      downloadLast: () => state.last && runDownload(mediaUrl(state.last.element) || state.last.url),
      debug: (v) => {
        verbose = !!v;
        info("verbose logging", verbose);
      },
    };
  } catch (_) {
    /* ignore */
  }

  // Test hook: expose helpers to Node unit tests. No-op in browsers/userscript
  // (there `module` is undefined). `download` is exported to test the core engine
  // against a mocked page.fetch; the DOM/UI code paths are not exported.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { describeStream, humanSize, extFromMime, withExt, download, fileSource, mediaUrl, createBlobCache, blobCache };
  }

  // ---------- boot ----------
  const tick = () => {
    capture();
    decorate();
  };

  const boot = () => {
    buildFloating();
    setInterval(tick, POLL_MS);
    info("ready — play a video/audio, then press ⬇ (inline or bottom-left).");
  };

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
