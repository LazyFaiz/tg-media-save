# Tests

Run `npm test` with Node.js 18+ and Python 3 (`python` in PATH). The suite uses Node's built-in test runner and no external test dependencies. The build test runs the portable Python builder and regenerates the userscript, extension content script and ZIP.

## Coverage

| File | Coverage |
|---|---|
| `unit.test.js` | Stream metadata, sizes, MIME extensions and names |
| `download.test.js` | Range assembly, retries, whole-response fallback, disk aborts, invalid responses, retained Blob downloads and cache limits |
| `content.test.js` | Console API and initial state under the DOM shim |
| `build.test.js` | Build outputs, manifest, version injection and source/output byte equality |
| `media-source.test.js` | HLS source resolution, ordinary blobs, source children, element reuse and invalid origins/descriptors |
| `blob-capture.test.js` | Creation hook, native revocation, saving identical Blob data and MediaSource rejection |
| `source-capture.test.js` | HLS-to-blob assignments, per-element isolation, setter exceptions, reuse and unrelated property definitions |

Tests load the real `src/content.js` with a DOM shim or VM context. Mock responses exercise download behavior without Telegram authentication. The guarded CommonJS export includes the download engine, source resolvers and Blob-cache helpers for these tests; it is inactive in normal browser execution.

## Validation of 1.0.5

49 tests passed. On 2026-09-21 the user confirmed successful downloading of the previously failing WebK MediaSource video after the 1.0.5 fix. This manual result supplements the simulated tests; it does not verify all Telegram clients, media formats or userscript environments.

Before submitting runtime changes, run `npm test` and `npm run build`, then load the unpacked extension (or userscript), refresh Telegram, reopen and play a video, and check that the download button appears and the saved file opens. The automated tests use mocks and cannot establish compatibility with a live Telegram session. See [troubleshooting](../docs/TROUBLESHOOTING.md) for diagnosis.
