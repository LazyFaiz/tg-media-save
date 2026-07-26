"use strict";
// Unit tests for the pure helpers exported by src/content.js.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { installDomShim } = require("./helpers");
installDomShim();
const { describeStream, humanSize, extFromMime, withExt } = require("../src/content.js");

// ---------- humanSize ----------
test("humanSize: empty for falsy input", () => {
  assert.equal(humanSize(0), "");
  assert.equal(humanSize(undefined), "");
  assert.equal(humanSize(null), "");
});

test("humanSize: bytes (no decimals)", () => {
  assert.equal(humanSize(1), "1 B");
  assert.equal(humanSize(512), "512 B");
  assert.equal(humanSize(1023), "1023 B");
});

test("humanSize: KB with one decimal when < 10", () => {
  assert.equal(humanSize(1024), "1.0 KB");
  assert.equal(humanSize(1536), "1.5 KB");
});

test("humanSize: KB without decimals when >= 10", () => {
  assert.equal(humanSize(10 * 1024), "10 KB");
  assert.equal(humanSize(900 * 1024), "900 KB");
});

test("humanSize: MB", () => {
  assert.equal(humanSize(1024 * 1024), "1.0 MB");
  assert.equal(humanSize(387983156), "370 MB"); // a real ~370 MB Telegram video
});

test("humanSize: GB", () => {
  assert.equal(humanSize(1024 * 1024 * 1024), "1.0 GB");
  assert.equal(humanSize(2.5 * 1024 * 1024 * 1024), "2.5 GB");
});

// ---------- extFromMime ----------
test("extFromMime: known types", () => {
  const cases = {
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
  for (const [mime, ext] of Object.entries(cases)) assert.equal(extFromMime(mime), ext);
});

test("extFromMime: unknown type falls back to the subtype", () => {
  assert.equal(extFromMime("application/zip"), "zip");
  assert.equal(extFromMime("video/x-matroska"), "x-matroska");
});

test("extFromMime: empty / missing / malformed -> bin", () => {
  assert.equal(extFromMime(""), "bin");
  assert.equal(extFromMime(null), "bin");
  assert.equal(extFromMime(undefined), "bin");
  assert.equal(extFromMime("video/"), "bin");
});

// ---------- withExt ----------
test("withExt: appends extension when missing", () => {
  assert.equal(withExt("file", "video/mp4"), "file.mp4");
  assert.equal(withExt("noext", "image/jpeg"), "noext.jpg");
});

test("withExt: keeps an existing extension", () => {
  assert.equal(withExt("file.mp4", "video/mp4"), "file.mp4");
  assert.equal(withExt("clip.mov", "video/mp4"), "clip.mov");
  assert.equal(withExt("archive.tar.gz", "video/mp4"), "archive.tar.gz");
});

test("withExt: empty/unknown mime -> .bin fallback", () => {
  assert.equal(withExt("name", ""), "name.bin");
  assert.equal(withExt("name", null), "name.bin");
});

// ---------- describeStream ----------
const streamUrl = (obj) => "https://web.telegram.org/k/stream/" + encodeURIComponent(JSON.stringify(obj));

test("describeStream: parses a real /stream/ descriptor", () => {
  const url = streamUrl({
    dcId: 2,
    location: { _: "inputDocumentFileLocation", id: "5364130427164468213" },
    size: 387983156,
    mimeType: "video/mp4",
    fileName: "ivan_marketing.mp4",
  });
  assert.deepEqual(describeStream(url), {
    name: "ivan_marketing.mp4",
    size: 387983156,
    mime: "video/mp4",
    dcId: 2,
  });
});

test("describeStream: decodes unicode file names", () => {
  const url = streamUrl({ size: 1000, mimeType: "video/mp4", fileName: "часть 2.mp4" });
  assert.equal(describeStream(url).name, "часть 2.mp4");
});

test("describeStream: size-only descriptor", () => {
  const d = describeStream(streamUrl({ size: 100 }));
  assert.equal(d.size, 100);
  assert.equal(d.name, null);
});

test("describeStream: returns null for non-stream URLs", () => {
  assert.equal(describeStream("https://cdn.telegram.org/file/video.mp4"), null);
  assert.equal(describeStream("blob:https://web.telegram.org/abc-123"), null);
  assert.equal(describeStream(""), null);
  assert.equal(describeStream("not-json"), null);
});

test("describeStream: returns null when descriptor has neither fileName nor size", () => {
  assert.equal(describeStream(streamUrl({ foo: "bar" })), null);
});
