# AGENTS.md — TG Media Saver

Instructions and context for AI coding agents (and human developers) working in this repository.

## What this is

A browser tool that saves media (photos, videos, GIFs, voice messages) from **Telegram Web**
(`web.telegram.org`, including the `/k/` and `/z/` clients), including channels with
"restrict saving content" enabled. It is an **original, MIT-licensed implementation**, not a
derivative of any existing script. Not affiliated with Telegram.

It ships in **two distribution modes from a single source of truth**:

1. **Userscript** (Tampermonkey / Violentmonkey) — `tg-media-saver.user.js`.
2. **Chrome MV3 extension** — `extension/` (loaded unpacked or zipped for the store).

## Start here

- Read [`README.md`](./README.md) for the user-facing view (install, usage, troubleshooting).
- The single source of logic is [`src/content.js`](./src/content.js). Everything else is
  generated or static.
- Version lives in **one place**: `extension/manifest.json` → `version`. The build injects it
  into the userscript header.

## Architecture (the parts that are easy to get wrong)

- **CSP bypass.** `web.telegram.org` has a strict CSP that blocks page-world script injection.
  - Userscript: runs in the **isolated world** via `@grant unsafeWindow`.
  - Extension: runs as a **MAIN-world** content script (`manifest.json` → `"world": "MAIN"`,
    requires Chrome 111+). Browser-injected content scripts are NOT subject to the page CSP.
  - Do **not** switch the userscript to `@grant none` — that injects into the page world via a
    `<script>` tag and gets silently blocked by the CSP.
  - On Chrome MV3, Tampermonkey's **"Allow user scripts"** toggle must be enabled or no
    userscript runs at all.

- **Page-context fetch.** Telegram `/k/` serves media through its own **Service Worker** at
  `/k/stream/<urlencoded JSON descriptor>`. The bytes only arrive if the fetch runs in the
  **page context** (so the SW intercepts it). Therefore every network/blob/save call goes
  through `page`, resolved as:
  ```js
  const page = typeof unsafeWindow !== "undefined" && unsafeWindow ? unsafeWindow : window;
  ```
  In the userscript `page === unsafeWindow` (page window); in the extension MAIN world
  `unsafeWindow` is undefined so `page === window` (also the page window). Use `page.fetch`,
  `page.Blob`, `page.URL`, `page.showSaveFilePicker` — never the bare content-script globals —
  for anything that must touch the media pipeline.

- **Stream descriptor.** `/k/stream/<seg>` where `<seg>` is `decodeURIComponent` + `JSON.parse`
  of `{ dcId, location, size, mimeType, fileName }`. `describeStream(url)` extracts the real
  `fileName`/`size`/`mimeType`. This is how we name files correctly.

- **Capture.** Media URLs are discovered by **polling** `<video>`/`<audio>` `currentSrc`
  (`capture()`, every `POLL_MS`). The DOM is shared between worlds, so this works from the
  isolated world too. A `data-tgs-src` attribute marks already-seen elements.

- **Download engine.** `download(url, onProgress)`:
  - `blob:`/`data:` → single `fetch` → save.
  - Otherwise HTTP `Range` chunking. If the File System Access API is available, stream chunks
    to disk via `showSaveFilePicker().createWritable()`; else accumulate blobs and concatenate.
    If the server ignores `Range` (no `Content-Range`), fall back to saving the whole response.

- **UI.** Inline ⬇ buttons on feed media (`decorate()`) + a floating ⬇ bottom-left
  (`buildFloating()`) that saves the last captured media. Console helpers live on
  `page.tgSaver` (`status`, `downloadLast`, `debug`).

## File map

```
src/content.js             # SINGLE SOURCE OF TRUTH (the whole IIFE). Edit logic here.
src/userscript.meta.js     # Userscript header template; contains __VERSION__ placeholder.
extension/manifest.json    # MV3 manifest (icons, action+popup, MAIN-world content script). VERSION source.
extension/content.js       # GENERATED copy of src/content.js (do not edit by hand).
extension/popup.html/.css  # Toolbar help popup (static; no inline JS — MV3 forbids it).
extension/icons/*.png      # GENERATED icons (16/48/128).
tg-media-saver.user.js     # GENERATED userscript (header + content). Installable via raw URL.
assets/icon.svg            # Vector icon source (design reference).
assets/icon128.png,512.png # GENERATED store/promo icons.
scripts/build.sh           # Build: userscript + extension/content.js + dist zip.
scripts/make_icons.py      # Regenerate PNG icons (Pillow via uv).
test/                      # Node built-in tests (unit, download engine, content boot, build).
test/helpers.js            # DOM shim so src/content.js loads in Node.
package.json               # `npm test` / `npm run build` (no runtime deps).
.github/workflows/ci.yml   # GitHub Actions: npm test on push/PR.
README.md / README.ru.md   # User docs (English base + Russian).
dist/                      # Build output (gitignored).
```

## Commands

```bash
# Build both distributables (reads version from extension/manifest.json)
./scripts/build.sh

# Run the test suite (Node built-in runner, no dependencies)
npm test

# Regenerate icons after editing assets/icon.svg or scripts/make_icons.py
uv run --with pillow python scripts/make_icons.py

# Quick sanity checks
node --check src/content.js
python3 -c "import json;json.load(open('extension/manifest.json'))"
```

## Testing

Tests use Node's built-in test runner (`node --test`) — **no dependencies**, run via `npm test`.
CI (`.github/workflows/ci.yml`) runs `npm test` on every push/PR.

- `test/unit.test.js` — pure helpers: `describeStream`, `humanSize`, `extFromMime`, `withExt`.
- `test/download.test.js` — the core `download()` engine against a **mocked `page.fetch`**:
  Range chunking + blob concatenation, the "server ignores Range" fallback, the `blob:`/`data:`
  single-shot branch, and non-2xx error propagation.
- `test/content.test.js` — loads the real `src/content.js` under a DOM shim and verifies the
  boot path exposes the `tgSaver` console API.
- `test/build.test.js` — runs `scripts/build.sh` and validates every artifact.

**Test hook in `src/content.js`:** the IIFE ends with a guarded
`if (typeof module !== "undefined" && module.exports) module.exports = { describeStream,
humanSize, extFromMime, withExt, download }`. This is a no-op in browsers/userscript (no
`module`). Keep it when refactoring; tests depend on it. `download` is exported so the engine
can be tested with a mocked page context.

**DOM shim (`test/helpers.js`):** sets `global.window = {}` and a minimal `document` with
`body: null` so the IIFE loads in Node without running `boot()` (no timers/DOM). Tests that
exercise `download()` then set `document.body` and a recording `document.createElement`.

Before submitting changes, all of these must pass:
1. `npm test` (unit + download engine + build/manifest).
2. `./scripts/build.sh` (regenerates artifacts; must succeed).
3. Manual smoke test: load the extension unpacked (or the userscript) on `web.telegram.org`,
   play a video, confirm the ⬇ appears and saves. See README → Troubleshooting.

## Conventions & invariants

- **Edit `src/content.js`, never the generated files** (`tg-media-saver.user.js`,
  `extension/content.js`). Run `./scripts/build.sh` after editing so generated files stay in
  sync. Commit the regenerated files (they are tracked for convenience / raw-URL install).
- Keep the version in `extension/manifest.json`; the build propagates it. Bump it in
  `CHANGELOG.md` too.
- Plain JS, no build-time transpilation, no dependencies at runtime. The only dev-time
  dependency is Pillow (via `uv`) for icons.
- Keep the userscript header (`src/userscript.meta.js`) fields valid; `@downloadURL`/`@updateURL`
  point at the GitHub raw `.user.js` for auto-updates.
- The extension requests **no permissions** beyond `content_scripts` matches. Do not add
  broad host permissions or background service workers unless strictly necessary — minimal
  permissions matter for store review and user trust.
- `popup.html` must not contain inline `<script>` (MV3 CSP). If popup logic is ever needed,
  add an external JS file referenced from the HTML.
- Comments: only where the *why* is non-obvious (CSP, page-context fetch, SW dependency).
  Do not narrate the code.

## Boundaries & responsibility

- Read-only with respect to Telegram: the tool **downloads** media the logged-in account can
  already view. It must never post, vote, message, log in, or act as the user.
- Do not add telemetry, analytics, or any network egress other than fetching the media the user
  explicitly requested. The privacy promise (no data collection) is part of the product.
- This tool can circumvent a channel's "restrict saving content" flag. Keep the responsible-use
  disclaimer in user-facing docs. Do not market it as a way to pirate content.

## Known external failure (not a bug here)

If Telegram's Service Worker / MTProto pipeline is in a bad state (console shows
`FetchEvent … rejected`, `ERR_NETWORK_CHANGED`, `[MP-SERVICE] worker task error`), the page
itself cannot play the media, so nothing can download it. This is a Telegram-side state issue
(often after a network/VPN change), fixed by reloading / unregistering the SW / re-login — see
README → Troubleshooting. Do not try to "fix" this in the content script.

## Git

- Stage explicitly; no `git add -A`. Do not commit secrets (there are none in this project).
- `dist/` is gitignored. Generated `tg-media-saver.user.js` and `extension/content.js` ARE
  committed (intentionally, for raw-URL install and unpacked loading without a build step).
