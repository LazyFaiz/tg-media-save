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
      const start = Number(range.replace("bytes=", "").replace("-", ""));
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
  assert.deepEqual(calls, ["bytes=0-", "bytes=50-"]);
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
