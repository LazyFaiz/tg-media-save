"use strict";
// End-to-end build verification: run scripts/build.sh from a clean checkout state
// and assert every distributable is produced correctly.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

test("build.sh succeeds and produces all artifacts", () => {
  execSync("python scripts/build.py", { cwd: ROOT, stdio: "pipe" });
  assert.ok(exists("tg-media-save.user.js"), "userscript");
  assert.ok(exists("extension/content.js"), "extension content script");
  assert.ok(exists("dist/tg-media-save-extension.zip"), "store zip");
});

test("userscript has a valid header with the manifest version injected", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  const us = read("tg-media-save.user.js");
  assert.match(us, /^\/\/ ==UserScript==/);
  assert.match(us, /\/\/ ==\/UserScript==/);
  assert.ok(us.includes("@name         TG Media Save"));
  assert.ok(us.includes(`@version      ${manifest.version}`), "version must match manifest");
  assert.ok(!us.includes("__VERSION__"), "version placeholder must be replaced");
});

test("extension/content.js is byte-identical to src/content.js", () => {
  const a = fs.readFileSync(path.join(ROOT, "src/content.js"));
  const b = fs.readFileSync(path.join(ROOT, "extension/content.js"));
  assert.ok(a.equals(b), "generated extension content must match the source of truth");
});

test("manifest is MV3, MAIN world, document_start, and references existing files", () => {
  const m = JSON.parse(read("extension/manifest.json"));
  assert.equal(m.manifest_version, 3);

  const cs = m.content_scripts[0];
  assert.equal(cs.world, "MAIN");
  assert.equal(cs.run_at, "document_start");
  assert.ok(cs.matches.every((x) => x.startsWith("https://")));

  for (const f of [...cs.js, m.action.default_popup]) {
    assert.ok(exists(path.join("extension", f)), `missing ${f}`);
  }
  for (const size of ["16", "48", "128"]) {
    const icon = m.icons[size];
    assert.ok(exists(path.join("extension", icon)), `missing icon ${icon}`);
    assert.ok(fs.statSync(path.join(ROOT, "extension", icon)).size > 0, `empty icon ${icon}`);
  }
});

test("popup has no inline <script> (MV3 CSP forbids it)", () => {
  const html = read("extension/popup.html");
  assert.ok(!/<script(?![^>]*\ssrc=)/i.test(html), "popup must use external scripts only");
});
