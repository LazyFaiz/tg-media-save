"use strict";
// Tests for the core download engine (download()) against a mocked page context.
// Verifies HTTP Range chunking, blob concatenation, the blob:/data: single-shot
// branch, and the "server ignores Range" fallback — without a browser or network.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { installDomShim } = require("./helpers");
const win = installDomShim(); // document.body = null -> boot() is skipped on require
const { download } = require("../src/content.js");

// ---- mock page context (download() uses `page.*`, and page === win) ----
class MockBlob {
  constructor(parts = [], opts = {}) {
    this.parts = parts;
    this.type = opts.type || "";
    this.size = parts.reduce(
      (n, p) => n + (typeof p === "string" ? p.length : p && p.size ? p.size : 0),
      0
    );
  }
}

const created = []; // anchors created via document.createElement
function setupPage({ fetchImpl }) {
  created.length = 0;
  win.Blob = MockBlob;
  win.URL = { createObjectURL: () => "blob:mock-url", revokeObjectURL: () => {} };
  delete win.showSaveFilePicker; // force the in-memory blob path
  win.fetch = fetchImpl;
  // document.body must exist for saveBlob(); createElement records anchors.
  global.document.body = { appendChild() {}, removeChild() {} };
  global.document.createElement = (tag) => {
    const el = { tag, style: {}, click() {}, remove() {}, setAttribute() {} };
    created.push(el);
    return el;
  };
}

const res = (status, headers, body) => ({
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  blob: async () => new MockBlob([body], { type: headers["content-type"] }),
});

const streamUrl = (obj) => "https://web.telegram.org/k/stream/" + encodeURIComponent(JSON.stringify(obj));
const lastAnchor = () => created.filter((e) => e.tag === "a").pop();

// ---------- Range chunking ----------
test("download: assembles a file from Range chunks", async () => {
  const calls = [];
  setupPage({
    fetchImpl: async (url, opts) => {
      const range = opts.headers.Range;
      calls.push(range);
      const start = Number(range.match(/^bytes=(\d+)-/)[1]);
      if (start === 0) {
        return res(206, { "content-type": "video/mp4", "content-range": "bytes 0-49/100" }, "a".repeat(50));
      }
      if (start === 50) {
        return res(206, { "content-type": "video/mp4", "content-range": "bytes 50-99/100" }, "b".repeat(50));
      }
      throw new Error("unexpected range " + range);
    },
  });

  const progress = [];
  const url = streamUrl({ fileName: "movie.mp4", size: 100, mimeType: "video/mp4", dcId: 2 });
  const name = await download(url, (p) => progress.push(p));

  assert.equal(name, "movie.mp4");
  assert.deepEqual(calls, ["bytes=0-99", "bytes=50-99"]);
  assert.deepEqual(progress, [0.5, 1]);

  const a = lastAnchor();
  assert.equal(a.href, "blob:mock-url");
  assert.equal(a.download, "movie.mp4");
});

// ---------- server ignores Range ----------
test("download: falls back to whole-file save when the server ignores Range", async () => {
  let count = 0;
  setupPage({
    fetchImpl: async () => {
      count++;
      return res(200, { "content-type": "video/mp4" }, "x".repeat(123)); // no Content-Range
    },
  });

  const progress = [];
  const url = streamUrl({ fileName: "one.mp4", size: 123, mimeType: "video/mp4" });
  const name = await download(url, (p) => progress.push(p));

  assert.equal(name, "one.mp4");
  assert.equal(count, 1, "must fetch exactly once");
  assert.deepEqual(progress, [1]);
  assert.equal(lastAnchor().download, "one.mp4");
});

// ---------- blob:/data: single shot ----------
test("download: blob: source is fetched in a single shot", async () => {
  const calls = [];
  setupPage({
    fetchImpl: async (url) => {
      calls.push(url);
      return res(200, { "content-type": "video/webm" }, "y".repeat(10));
    },
  });

  const name = await download("blob:https://web.telegram.org/abc-123");

  assert.equal(calls.length, 1);
  assert.equal(calls[0], "blob:https://web.telegram.org/abc-123");
  assert.match(name, /\.webm$/, "name gets the mime-derived extension");
  assert.equal(lastAnchor().download, name);
});

// ---------- error propagation ----------
test("download: surfaces non-2xx responses as errors", async () => {
  setupPage({ fetchImpl: async () => res(403, { "content-type": "video/mp4" }, "") });
  const url = streamUrl({ fileName: "x.mp4", size: 1, mimeType: "video/mp4" });
  await assert.rejects(() => download(url), /HTTP 403/);
});

// ---------- File System Access (stream to disk via a writable) ----------
function setupWritable() {
  const writes = [];
  const state = { closed: false, aborted: false, suggestedName: null };
  const writable = {
    write: async (blob) => {
      writes.push(blob);
    },
    close: async () => {
      state.closed = true;
    },
    abort: async () => {
      state.aborted = true;
    },
  };
  // Must run AFTER setupPage() (which deletes showSaveFilePicker).
  win.showSaveFilePicker = async (opts) => {
    state.suggestedName = opts && opts.suggestedName;
    return { createWritable: async () => writable };
  };
  return { writes, state };
}

test("download: streams Range chunks to disk via the File System Access API", async () => {
  setupPage({
    fetchImpl: async (url, opts) => {
      const start = Number(opts.headers.Range.match(/^bytes=(\d+)-/)[1]);
      if (start === 0) {
        return res(206, { "content-type": "video/mp4", "content-range": "bytes 0-49/100" }, "a".repeat(50));
      }
      if (start === 50) {
        return res(206, { "content-type": "video/mp4", "content-range": "bytes 50-99/100" }, "b".repeat(50));
      }
      throw new Error("unexpected range " + opts.headers.Range);
    },
  });
  const { writes, state } = setupWritable();

  const progress = [];
  const url = streamUrl({ fileName: "movie.mp4", size: 100, mimeType: "video/mp4" });
  const name = await download(url, (p) => progress.push(p));

  assert.equal(name, "movie.mp4");
  assert.equal(state.suggestedName, "movie.mp4");
  assert.equal(writes.length, 2, "both chunks written to the writable");
  assert.equal(state.closed, true, "writable closed on success");
  assert.equal(state.aborted, false, "not aborted on success");
  assert.deepEqual(progress, [0.5, 1]);
  assert.equal(lastAnchor(), undefined, "no anchor download in the writable path");
});

test("download: aborts the writable when a chunk fetch fails", async () => {
  setupPage({
    fetchImpl: async (url, opts) => {
      const start = Number(opts.headers.Range.match(/^bytes=(\d+)-/)[1]);
      if (start === 0) {
        return res(206, { "content-type": "video/mp4", "content-range": "bytes 0-49/100" }, "a".repeat(50));
      }
      return res(500, { "content-type": "video/mp4" }, ""); // second chunk fails
    },
  });
  const { writes, state } = setupWritable();

  const url = streamUrl({ fileName: "movie.mp4", size: 100, mimeType: "video/mp4" });
  await assert.rejects(() => download(url), /HTTP 500/);

  assert.equal(writes.length, 1, "first chunk written before the failure");
  assert.equal(state.aborted, true, "writable aborted on error");
  assert.equal(state.closed, false, "writable not closed on error");
});

test("download: retries a failed body at the same offset", async () => {
  const calls = [];
  setupPage({ fetchImpl: async (url, opts) => {
    calls.push(opts.headers.Range);
    if (calls.length === 1) return { status: 206, blob: async () => { throw new TypeError('Failed to fetch'); } };
    return res(206, { 'content-range': 'bytes 0-2/3' }, 'abc');
  }});
  await download(streamUrl({ fileName: 'retry.bin', size: 3 }));
  assert.deepEqual(calls, ['bytes=0-2', 'bytes=0-2']);
});

test("download: persistent network failure is bounded and aborts output", async () => {
  let calls = 0;
  setupPage({ fetchImpl: async () => { calls++; throw new TypeError('Failed to fetch'); }});
  const { state, writes } = setupWritable();
  await assert.rejects(download(streamUrl({ size: 3 })), /Failed to fetch/);
  assert.equal(calls, 3);
  assert.equal(state.aborted, true);
  assert.equal(writes.length, 0);
});

for (const [range, body] of [['bytes 1-3/4', 'abc'], ['bytes 0-3/4', 'ab'], [null, 'abc']]) {
  test(`download: rejects invalid partial response ${range}`, async () => {
    setupPage({ fetchImpl: async () => res(206, { 'content-range': range }, body) });
    const { state } = setupWritable();
    await assert.rejects(download(streamUrl({ size: 4 })), /Content-Range/);
    assert.equal(state.aborted, true);
    assert.equal(state.closed, false);
  });
}

test("download: full response after a chunk resets disk output", async () => {
  let count = 0;
  setupPage({ fetchImpl: async () => ++count === 1
    ? res(206, { 'content-range': 'bytes 0-1/4' }, 'ab')
    : res(200, {}, 'abcd') });
  const operations = [];
  win.showSaveFilePicker = async () => ({ createWritable: async () => ({
    write: async b => operations.push(['write', b.size]),
    seek: async n => operations.push(['seek', n]),
    truncate: async n => operations.push(['truncate', n]),
    close: async () => operations.push(['close']), abort: async () => {}
  }) });
  await download(streamUrl({ size: 4 }));
  assert.deepEqual(operations, [['write', 2], ['seek', 0], ['truncate', 0], ['write', 4], ['close']]);
});

test('download: retained revoked Blob saves without fetching its dead URL', async () => {
  const { blobCache } = require('../src/content.js');
  setupPage({ fetchImpl: async () => { throw new Error('must not fetch revoked URL'); } });
  blobCache.put('blob:revoked', new MockBlob(['complete-file'], { type: 'video/mp4' }));
  const name = await download('blob:revoked');
  assert.match(name, /\.mp4$/);
  assert.equal(lastAnchor().download, name);
});

test('download: captured MediaSource is not saved as a file', async () => {
  const { blobCache } = require('../src/content.js');
  setupPage({ fetchImpl: async () => { throw new Error('must not fetch MediaSource'); } });
  blobCache.put('blob:mse', null);
  await assert.rejects(download('blob:mse'), /uses MediaSource/);
  assert.equal(lastAnchor(), undefined);
});

test('Blob retention expires and respects byte and entry limits', () => {
  const { createBlobCache } = require('../src/content.js');
  let now = 0;
  const cache = createBlobCache(() => now, 10, 100);
  cache.put('a', { size: 6 }); cache.put('b', { size: 6 });
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.status().bytes, 6);
  cache.put('large', { size: 11 });
  assert.equal(cache.get('large'), undefined);
  now = 100;
  assert.deepEqual(cache.status(), { entries: 0, bytes: 0 });
  for (let i = 0; i < 40; i++) cache.put(String(i), null);
  assert.equal(cache.status().entries, 32);
});
