'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('early hook retains revoked Blob bytes without interfering with native revocation', async () => {
  let id = 0;
  const created = [], revoked = [], clicked = [];
  class MediaSource {}
  const page = { Blob, MediaSource, URL: {
    createObjectURL(blob) { created.push(blob); return `blob:${++id}`; },
    revokeObjectURL(url) { revoked.push(url); }
  }, fetch() { throw new Error('must not fetch dead URLs'); } };
  const context = { window: page, module: { exports: {} }, console,
    setInterval() {}, setTimeout() {},
    document: { body: null, addEventListener() {}, querySelectorAll: () => [],
      createElement: () => ({ click() { clicked.push(this.download); }, remove() {} }) }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/content.js'), 'utf8'), context);
  const original = new Blob(['complete video bytes'], { type: 'video/mp4' });
  const url = page.URL.createObjectURL(original);
  page.URL.revokeObjectURL(url);
  assert.deepEqual(revoked, [url]);
  context.document.body = { appendChild() {} };
  await context.module.exports.download(url);
  assert.equal(created[1], original);
  assert.equal(await created[1].text(), 'complete video bytes');
  assert.match(clicked[0], /\.mp4$/);
  assert.equal(page.tgSaver.status().retained.entries, 1);
  const mse = page.URL.createObjectURL(new MediaSource());
  await assert.rejects(context.module.exports.download(mse), /uses MediaSource/);
  assert.equal(clicked.length, 1);
  assert.equal(page.tgSaver.diagnose().blobCaptureInstalled, true);
});
