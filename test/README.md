# Tests

tg-media-save is tested with **Node's built-in test runner** — no dependencies.

```bash
npm test          # or: node --test test/*.test.js
```

CI (`.github/workflows/ci.yml`) runs `npm test` on every push and pull request.

## What is tested, where, and how

| File | What it verifies | How |
|---|---|---|
| `unit.test.js` | Pure helpers: `describeStream` (parses the `/stream/` JSON descriptor, decodes unicode file names, returns `null` for non-stream URLs), `humanSize` (B/KB/MB/GB formatting), `extFromMime` (known/unknown/empty), `withExt` (append vs. keep an existing extension) | Direct function calls + `node:assert` |
| `download.test.js` | The core `download()` engine: HTTP `Range` chunking + blob concatenation, the "server ignores `Range`" whole-file fallback, the `blob:`/`data:` single-shot branch, non-2xx error propagation, and the **File System Access** path (streaming chunks to a writable, `close()` on success, `abort()` on a failed chunk) | Mocks the page context (`page.fetch`, `page.Blob`, `page.URL`, `page.showSaveFilePicker`) and a recording `document.createElement`; asserts the fetch call sequence (`bytes=0-`, `bytes=50-`, …), progress callbacks, and the final download anchor / writable state |
| `content.test.js` | The boot path exposes the `tgSaver` console API (`status` / `downloadLast` / `debug`) and its initial state — without a browser | Loads the **real** `src/content.js` under a DOM shim (`document.body = null` ⇒ `boot()` is skipped, no timers/DOM) |
| `build.test.js` | The packaging pipeline: `scripts/build.sh` succeeds; the userscript has a valid header with the manifest version injected (no leftover `__VERSION__`); `extension/content.js` is byte-identical to `src/content.js`; the manifest is MV3 / `world: MAIN` / `document_start` and references files that exist; icons are present and non-empty; the popup has no inline `<script>` | Runs `scripts/build.sh`, then reads and validates every artifact |

## How the browser is simulated

`helpers.js` installs a minimal `window`/`document` shim so the real content script can be
`require`d in Node:

- `window` is a plain object, so `page = unsafeWindow || window` resolves to it and the console
  helpers attach there.
- `document.body` is left `null`, so the IIFE takes the `addEventListener` branch and does **not**
  auto-run `boot()` (no timers, no DOM building) at require time.

The `download()` tests then replace `page.fetch` / `page.Blob` / `page.URL` (and, for the
streaming-to-disk tests, `page.showSaveFilePicker`) with fakes, and capture the `<a>` element
that `saveBlob()` creates — so the whole pipeline is exercised **with no network and no browser**.

## The test hook in `src/content.js`

The IIFE ends with a guarded export:

```js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { describeStream, humanSize, extFromMime, withExt, download };
}
```

This is a no-op in browsers/userscript (there is no `module` there). Tests `require` the file to
reach the pure helpers and the `download()` engine. Keep this hook when refactoring.

## What is intentionally NOT covered

Real Telegram playback and the Service Worker behavior require a logged-in browser, so they are
not unit-tested. That path is the **manual smoke test**: load the extension/userscript on
`web.telegram.org`, play a video, and confirm ⬇ saves it (see
[docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)).
