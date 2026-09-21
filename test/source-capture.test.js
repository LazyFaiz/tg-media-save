'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('WebK HLS overwritten by blob keeps per-element source and clears on reuse', () => {
  class Media { getAttribute() { return this.src; } querySelectorAll() { return []; } }
  const page = { Object: { defineProperty: Object.defineProperty }, HTMLMediaElement: Media,
    URL, location: new URL('https://web.telegram.org/k/') };
  const context = { window: page, module: { exports: {} }, console,
    document: { body: null, addEventListener() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/content.js'), 'utf8'), context);
  const { mediaUrl } = context.module.exports;
  const source = id => 'hls/' + encodeURIComponent(JSON.stringify({ location: {
    _: 'inputDocumentFileLocation', id }, size: 12 }));
  const videos = [new Media(), new Media()];
  for (const [i, video] of videos.entries()) {
    let src = '';
    page.Object.defineProperty(video, 'src', { configurable: true,
      get: () => src, set(value) { if (value === 'throw') throw new Error('setter failure'); src = value; }
    });
    video.src = source(String(i));
    video.src = `blob:${i}`; video.currentSrc = `blob:${i}`;
    assert.equal(mediaUrl(video), 'https://web.telegram.org/k/' + source(String(i)).replace('hls/', 'stream/'));
  }
  assert.throws(() => { videos[0].src = 'throw'; }, /setter failure/);
  assert.match(mediaUrl(videos[0]), /stream/);
  videos[0].src = ''; videos[0].currentSrc = '';
  videos[0].src = 'blob:unrelated'; videos[0].currentSrc = 'blob:unrelated';
  assert.equal(mediaUrl(videos[0]), 'blob:unrelated');
  assert.match(mediaUrl(videos[1]), /stream/);
  const plain = {};
  page.Object.defineProperty(plain, 'src', { value: 123 });
  assert.equal(plain.src, 123);
});
