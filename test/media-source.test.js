"use strict";
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installDomShim } = require('./helpers');
const page = installDomShim();
page.URL = URL;
page.location = new URL('https://web.telegram.org/k/#chat');
const { mediaUrl, fileSource } = require('../src/content.js');
const descriptor = encodeURIComponent(JSON.stringify({
  location: { _: 'inputDocumentFileLocation', id: '1234567890123456789' },
  size: 10, fileName: 'movie.mp4', mimeType: 'video/mp4'
}));
const element = (src, blob = 'blob:https://web.telegram.org/player') => ({
  src, currentSrc: blob, getAttribute: () => blob, querySelectorAll: () => []
});
const expected = `https://web.telegram.org/k/stream/${descriptor}`;
test('WebK HLS original src takes precedence over MediaSource currentSrc', () => {
  assert.equal(mediaUrl(element(`hls/${descriptor}`)), expected);
});
test('absolute HLS and ordinary stream URLs resolve to the same document', () => {
  assert.equal(fileSource(`https://web.telegram.org/k/hls/${descriptor}`), expected);
  assert.equal(fileSource(expected), expected);
});
test('normal blob images and videos keep their original source', () => {
  assert.equal(mediaUrl(element('blob:ordinary', 'blob:ordinary')), 'blob:ordinary');
});
test('source children support stream URLs', () => {
  const el = element('');
  el.querySelectorAll = () => [{ src: expected }];
  assert.equal(mediaUrl(el), expected);
});
test('reused video resolves its own current document, never a cached blob', () => {
  const el = element(`hls/${descriptor}`);
  assert.equal(mediaUrl(el), expected);
  el.src = 'blob:new'; el.currentSrc = 'blob:new';
  assert.equal(mediaUrl(el), 'blob:new');
});
test('untrusted origins and malformed descriptors are not rewritten', () => {
  assert.equal(fileSource(`https://example.com/k/hls/${descriptor}`), null);
  assert.equal(fileSource('hls/%7Bbad'), null);
  assert.equal(fileSource('hls/' + encodeURIComponent('{"size":10}')), null);
});
