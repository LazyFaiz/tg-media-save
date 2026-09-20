# Architecture

How **tg-media-save** is built. For installation and usage see the [README](../README.md); for
agent/developer conventions see [AGENTS.md](../AGENTS.md).

## Two modes, one source

The same logic ships as a userscript and as a Chrome extension. Both run the single IIFE in
[`src/content.js`](../src/content.js) and both bypass Telegram's strict Content-Security-Policy
by running as a content script (never injected into the page world as an inline `<script>`).

```
                          tg-media-save
            ┌──────────────────────┴──────────────────────┐
            │                                             │
   Mode 1: Userscript                          Mode 2: Chrome Extension
   (Tampermonkey / Violentmonkey)              (Manifest V3)
            │                                             │
            │  @grant unsafeWindow                        │  content_scripts:
            │  → runs in ISOLATED world                   │    world: "MAIN"
            │    (bypasses page CSP)                      │    run_at: document_start
            │                                             │    (bypasses page CSP)
            └──────────────────────┬──────────────────────┘
                                   │
                                   ▼
                ┌────────────────────────────────────────┐
                │  src/content.js  (single IIFE)          │
                │  page = unsafeWindow || window          │  ← always the PAGE window
                └───────────────────┬────────────────────┘
                                    │  page.fetch(...)   ← must run in page context
                                    ▼
                ┌────────────────────────────────────────┐
                │  Telegram Service Worker (sw-*.js)      │
                │  intercepts  /k/stream/{json descriptor}│
                └───────────────────┬────────────────────┘
                                    │  MTProto (your logged-in session)
                                    ▼
                ┌────────────────────────────────────────┐
                │  Telegram CDN / DC  →  media bytes      │
                └────────────────────────────────────────┘
```

Key points:

- Telegram Web has a strict CSP that blocks page-world script injection. Both modes avoid it:
  the userscript runs in the isolated world (`@grant unsafeWindow`); the extension runs as a
  browser-injected MAIN-world content script.
- `/k/` serves media through its own **Service Worker** at `/k/stream/<urlencoded JSON>`. That
  JSON descriptor carries the real `fileName`, `size`, `mimeType`, `dcId`.
- To receive the bytes, the fetch must run in the **page context** (so the Service Worker
  intercepts it). That is why every network call goes through `page.fetch`
  (`unsafeWindow.fetch` / `window.fetch`), never the bare content-script `fetch`.

## Capture + download flow

```
   every 600 ms
   ┌───────────────────────────────────────────────────────────────┐
   │ capture():  scan <video>/<audio>.currentSrc                   │
   │   new URL? → store in state.last + parse /stream/ {json}      │
   │ decorate(): attach ⬇ to feed media + a floating ⬇ (bottom-left)│
   └───────────────────────────────┬───────────────────────────────┘
                                   │ user clicks ⬇
                                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ download(url, onProgress)                                      │
   │                                                                │
   │   blob: / data:  ───────────► single fetch ─► saveBlob()       │
   │                                                                │
   │   otherwise:                                                   │
   │     showSaveFilePicker available?                              │
   │        ├─ yes → stream each Range chunk straight to disk       │
   │        │        (abort the writable on error)                  │
   │        └─ no  → loop:                                          │
   │              fetch  Range: bytes=N-                            │
   │                ├─ 206 + Content-Range → collect chunk          │
   │                │     offset = end+1 ; onProgress(offset/total) │
   │                └─ no Content-Range   → save whole response     │
   │              until offset ≥ total                              │
   │              → new Blob(chunks) → saveBlob() (anchor click)    │
   └───────────────────────────────────────────────────────────────┘
```

`download()` guards against a malformed `Content-Range` header and against a stalled
(non-advancing) offset, and aborts the File System Access writable on error so a partially
written file is not left locked on disk.

## Build pipeline

```
   src/content.js   (single source of truth)
        │
        │   scripts/build.sh    (version read from extension/manifest.json)
        ├──────────────────────────────────────┐
        ▼                                      ▼
   src/userscript.meta.js                   (copy)
   + src/content.js                            │
        │                                      ▼
        ▼                            extension/content.js
   tg-media-save.user.js                      +  manifest.json
   → install into Tampermonkey                 +  popup.html/.css + icons/
        │                                      │
        │                                      ▼  zip
        │                            dist/tg-media-save-extension.zip
        │                            → load unpacked / distribute
        └─ version injected from manifest (__VERSION__ replaced)
```

### Building from source

Needs `bash`, `python3`, `zip` (for icons, `uv`):

```bash
./scripts/build.sh
```

Output:

- `tg-media-save.user.js` — userscript (version injected from `extension/manifest.json`);
- `extension/content.js` — copy of `src/content.js` for the extension;
- `dist/tg-media-save-extension.zip` — store-ready zip (manifest at the archive root).

Icons (if you change the design in [`assets/icon.svg`](../assets/icon.svg) or
[`scripts/make_icons.py`](../scripts/make_icons.py)):

```bash
uv run --with pillow python scripts/make_icons.py
```

> After editing `src/content.js`, always run `./scripts/build.sh` to refresh
> `tg-media-save.user.js` and `extension/content.js` (they are generated files, committed for
> raw-URL install and unpacked loading without a build step).

## Console helpers

Exposed on the page window (`page.tgSaver`):

- `tgSaver.status()` — what was captured last;
- `tgSaver.downloadLast()` — manually save the last captured media;
- `tgSaver.debug(true)` — verbose logging.

## Project structure

```
tg-media-save/
├── README.md / README.ru.md   # hero pages (EN / RU)
├── AGENTS.md                  # context for developers and AI agents
├── LICENSE · CHANGELOG.md
├── package.json               # npm test / npm run build (no runtime deps)
├── .gitignore · .gitattributes · .editorconfig
├── tg-media-save.user.js     # generated userscript (install into Tampermonkey)
├── src/
│   ├── content.js             # SINGLE source of logic
│   └── userscript.meta.js     # userscript header (template with __VERSION__)
├── extension/
│   ├── manifest.json          # MV3 manifest (icons, popup, MAIN-world content script)
│   ├── content.js             # generated copy of src/content.js
│   ├── popup.html / popup.css # toolbar help popup
│   └── icons/                 # icon16/48/128.png
├── assets/
│   ├── icon.svg               # vector icon source
│   └── icon128.png / icon512.png
├── scripts/
│   ├── build.sh               # build both distributables + zip
│   └── make_icons.py          # generate PNG icons (Pillow via uv)
├── test/                      # Node built-in test runner (see test/README.md)
├── docs/                      # ARCHITECTURE.md (this file), TROUBLESHOOTING.md
├── .github/workflows/ci.yml   # GitHub Actions: npm test on push/PR
└── dist/                      # build output (not committed)
```


## WebK HLS source resolution (1.0.3)

WebK overrides each video element's `src` property and retains its `hls/<DownloadOptions>` source, while `currentSrc` points to a MediaSource blob. Read `src` first, validate its same-origin document descriptor, and replace only the `hls` path component with `stream`. Never select a different video based on the most recent network request.

Verified against Telegram WebK sources:
- https://github.com/morethanwords/tweb/blob/master/src/helpers/dom/createVideo.ts
- https://github.com/morethanwords/tweb/blob/master/src/lib/appManagers/utils/docs/getDocumentURL.ts
- https://github.com/morethanwords/tweb/blob/master/src/helpers/fileName.ts
