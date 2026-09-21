# Architecture

**TG Media Save** ships as an MV3 extension and a userscript from [src/content.js](../src/content.js). Repository and artifact names use `tg-media-save`. Original author attribution is retained under MIT.

## Execution and source capture

The extension runs in MAIN world at document_start. The userscript accesses the page through unsafeWindow. Network, Blob, URL and file-picker operations use the page context. Hook availability can vary by userscript environment.

At startup, the script observes WebK's per-element `src` setter definitions through a narrowly filtered wrapper around `Object.defineProperty`. It remembers a valid same-origin HLS/stream document source in a WeakMap. When that element is assigned a MediaSource blob, it retains the association with that blob. Unrelated assignments clear the association; setter exceptions restore the previous state. Other property definitions pass through unchanged.

`mediaUrl()` first inspects current source properties and source children, then uses the recorded source only when the element's current blob matches. Valid HLS descriptors become stream URLs for the same document. It never selects a file using the most recent network request. Capture must run before playback initialization, so extension reload must be followed by a page refresh.

A separate `URL.createObjectURL` hook retains ordinary Blob references and records MediaSource type markers. It preserves native return values and does not alter revocation. Retention is capped at 32 entries, 512 MiB total and five minutes per entry; oversized Blobs are skipped. Expiry is checked on access and by a one-minute cleanup timer. URLs created by the saver itself are excluded.

## Download flow

1. Poll media elements every 600 ms, resolve sources and attach save buttons. Floating downloads re-resolve the associated element on click.
2. For retained file Blobs, save the original bytes directly. Otherwise fetch ordinary blob/data URLs. A captured MediaSource with no resolved file source produces a diagnostic error instead of being saved as a file.
3. For stream URLs, request ranges of at most 1 MiB, clamped to the known file size. Retry transient fetch/body failures at the same offset up to three total attempts.
4. Validate partial-response offsets, body lengths and total sizes. A complete HTTP 200 response replaces any previously written partial output.
5. Write to a File System Access writable when available, otherwise collect chunks in memory. Abort the writable on failure. Blob downloads use an anchor; release the resulting object URL after 30 seconds.

Telegram's Service Worker serves stream bytes using the existing logged-in session. The extension performs no login, messaging or telemetry.

## Building from source

Requires Node.js 18+ and Python 3, with `python` in PATH:

```sh
npm run build
npm test
```

`scripts/build.py` reads `extension/manifest.json` for the version and generates:

- `extension/content.js`: byte-identical copy of the source.
- `tg-media-save.user.js`: metadata template plus source.
- `dist/tg-media-save-extension.zip`: manifest and extension assets at archive root.

`scripts/build.sh` delegates to the same builder using `python3`. No standalone zip utility is needed. Edit source files, then rebuild the generated files. The userscript currently has no explicit update/download URL.

## Diagnostics and validation

`tgSaver.diagnose()` reports version, hook availability, retention totals and per-media source categories without raw URLs. `status()`, `downloadLast()` and `debug(true)` remain available; status/debug are developer helpers and can contain raw source details.

Version 1.0.5 passed 49 automated tests. On 2026-09-21 the user confirmed the previously failing WebK video downloaded successfully. This is one real-world regression confirmation, not coverage of all clients or media formats. See [test coverage](../test/README.md).

## Telegram implementation references

- [createVideo.ts](https://github.com/morethanwords/tweb/blob/master/src/helpers/dom/createVideo.ts)
- [getDocumentURL.ts](https://github.com/morethanwords/tweb/blob/master/src/lib/appManagers/utils/docs/getDocumentURL.ts)
- [fileName.ts](https://github.com/morethanwords/tweb/blob/master/src/helpers/fileName.ts)

These are implementation-dependent integration points and may change upstream.
