"use strict";
// Integration-ish test: load the real src/content.js under a DOM shim and verify
// the boot path exposes the console API without touching a real browser.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { installDomShim } = require("./helpers");
const win = installDomShim();
require("../src/content.js"); // runs the IIFE; attaches tgSaver to `page` (=== win)

test("boot exposes the tgSaver console API on the page window", () => {
  assert.ok(win.tgSaver, "tgSaver should be defined");
  assert.equal(typeof win.tgSaver.status, "function");
  assert.equal(typeof win.tgSaver.downloadLast, "function");
  assert.equal(typeof win.tgSaver.debug, "function");
});

test("status() reports the initial empty state", () => {
  const s = win.tgSaver.status();
  assert.equal(s.last, null);
  assert.equal(s.verbose, false);
});

test("debug() toggles verbose logging", () => {
  win.tgSaver.debug(true);
  assert.equal(win.tgSaver.status().verbose, true);
  win.tgSaver.debug(false);
  assert.equal(win.tgSaver.status().verbose, false);
});

test("downloadLast() is a safe no-op when nothing is captured", () => {
  assert.doesNotThrow(() => win.tgSaver.downloadLast());
});
