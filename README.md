# TG Media Saver

[![CI](https://github.com/eiler2005/tg-media-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/eiler2005/tg-media-saver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-229ed9.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-229ed9.svg)](./CHANGELOG.md)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-229ed9.svg)](https://developer.chrome.com/docs/extensions/mv3)

**Русский → [README.ru.md](./README.ru.md)**

Save **photos, videos, GIFs and voice messages** from [Telegram Web](https://web.telegram.org)
(the `/k/` and `/z/` clients) — including channels with **"Restrict saving content"** enabled.

Original, independent implementation. Not affiliated with Telegram.

> ⚠️ **Responsible use.** The tool only works with what your account can already see in Telegram.
> Use it only for content you have the rights to (your own files, permitted materials). Respect
> Telegram's Terms of Service and content owners' copyright.

---

## Features

- ⬇ save button right on videos/photos **in the chat feed**.
- Floating ⬇ button (bottom-left) — saves the last loaded media, shows the **real file name and size**.
- Large files stream **straight to disk** via the File System Access API where available,
  otherwise assembled into a Blob and downloaded.
- Correct file names and extensions (parsed from Telegram's stream descriptor).
- Bypasses Telegram's strict Content-Security-Policy (content-script injection, not page-world).
- **No permissions** beyond running on `web.telegram.org`; collects nothing, sends nothing anywhere.

## Two installation modes

The same code ships in two forms. **Use one mode at a time** (otherwise buttons duplicate).

| Mode | For | How to install |
|---|---|---|
| **1. Userscript** | Tampermonkey / Violentmonkey | [below](#mode-1-userscript) |
| **2. Chrome extension (MV3)** | Chrome / Edge / Brave / Chromium 111+ | [below](#mode-2-chrome-extension) |

---

## Mode 1: Userscript

1. Install [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. **Chrome (Manifest V3):** in `chrome://extensions` → Tampermonkey → enable
   **"Allow user scripts"** ("run code not reviewed by Google"). Without this toggle,
   userscripts silently do not run in Chrome.
3. Install the script either way:
   - **one click:** open
     [`tg-media-saver.user.js`](https://raw.githubusercontent.com/eiler2005/tg-media-saver/main/tg-media-saver.user.js)
     — Tampermonkey will offer to install it (auto-update is built in via `@updateURL`);
   - **manually:** create a new script and paste the contents of
     [`tg-media-saver.user.js`](./tg-media-saver.user.js).
4. Hard-reload the Telegram tab (Cmd/Ctrl+Shift+R).

## Mode 2: Chrome extension

Requires Chrome/Chromium **111+** (for `content_scripts` `"world": "MAIN"`).

**Option A — from source (load unpacked):**

1. Clone the repo and build (see [Building](#building-from-source)):
   ```bash
   git clone https://github.com/eiler2005/tg-media-saver.git
   cd tg-media-saver
   ./scripts/build.sh
   ```
2. Open `chrome://extensions`, enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the [`extension/`](./extension) folder
   (the one containing `manifest.json`).
4. Hard-reload the Telegram tab (Cmd/Ctrl+Shift+R).

**Option B — ready zip:** after `./scripts/build.sh`, `dist/tg-media-saver-extension.zip`
is produced (manifest at the archive root), ready to load or distribute.

The extension is injected by the browser as a MAIN-world content script, so it is **not blocked
by the page CSP** and does **not** need Tampermonkey's "Allow user scripts" toggle.

---

## Usage

1. Open Telegram Web and **play** the video/audio (or open the photo) — the page must actually
   load the media.
2. Click ⬇ **on the media** in the feed — or the floating ⬇ button **bottom-left**.
3. The file saves with its real name; progress is shown as a percent above the floating button.

The button only appears once the page has actually received the media. If a video **won't play**,
Telegram isn't serving the stream (see [Troubleshooting](#troubleshooting)).

### Console helpers

In DevTools → Console:

- `tgSaver.status()` — what was captured last;
- `tgSaver.downloadLast()` — manually save the last captured media;
- `tgSaver.debug(true)` — verbose logging.

---

## Building from source

The single source of truth is [`src/content.js`](./src/content.js). The build generates both
distributables (needs `bash`, `python3`, `zip`; for icons, `uv`):

```bash
./scripts/build.sh
```

Output:

- `tg-media-saver.user.js` — userscript (version injected from `extension/manifest.json`);
- `extension/content.js` — copy of `src/content.js` for the extension;
- `dist/tg-media-saver-extension.zip` — store-ready zip (manifest at the archive root).

Icons (if you change the design in [`assets/icon.svg`](./assets/icon.svg) or
[`scripts/make_icons.py`](./scripts/make_icons.py)):

```bash
uv run --with pillow python scripts/make_icons.py
```

> After editing `src/content.js`, always run `./scripts/build.sh` to refresh
> `tg-media-saver.user.js` and `extension/content.js` (they are generated files).

## Testing

Tests run on Node's built-in test runner — **no dependencies**:

```bash
npm test
```

Coverage:

- `test/unit.test.js` — pure helpers (`describeStream`, `humanSize`, `extFromMime`, `withExt`).
- `test/download.test.js` — the core download engine against a mocked `page.fetch`:
  Range chunking + blob concatenation, the "server ignores Range" fallback, the `blob:`/`data:`
  single-shot branch, and error propagation.
- `test/content.test.js` — loads the real `src/content.js` under a DOM shim and verifies the
  boot path exposes the `tgSaver` console API.
- `test/build.test.js` — runs `scripts/build.sh` and validates every artifact (userscript header
  + injected version, `extension/content.js` in sync with the source, MV3 manifest fields,
  icons present, popup has no inline script).

CI runs `npm test` on every push and pull request (GitHub Actions).

---

## Troubleshooting

- **No buttons / no `[TG Media Saver]` logs.**
  - Userscript: is the script enabled in Tampermonkey? On Chrome, is **"Allow user scripts"** on?
  - Extension: is it enabled in `chrome://extensions`? Chrome ≥ 111?
- **Video won't play; console shows `FetchEvent … rejected`, `ERR_NETWORK_CHANGED`,
  `[MP-SERVICE] worker task error`.** Telegram's pipeline is broken (often after a network/VPN
  change), not the extension. Fix: stabilize the network → close other `web.telegram.org` tabs →
  Cmd+Shift+R. Still broken → DevTools → Application → Service Workers → **Unregister** → reload
  (do **not** enable "Bypass for network"). Nuclear → Storage → **Clear site data** → log in again.
- **Button present but download doesn't start.** Open DevTools → Console → filter
  `TG Media Saver` and read the error. Make sure the media actually plays.

## How it works (brief)

- Telegram Web has a strict CSP that blocks page-world script injection. Both modes avoid it:
  the userscript runs in the isolated world (`@grant unsafeWindow`); the extension runs as a
  browser-injected MAIN-world content script.
- `/k/` serves media through its own **Service Worker** at `/k/stream/<urlencoded JSON>`. That
  JSON descriptor carries the real `fileName`, `size`, `mimeType`, `dcId`.
- To receive the bytes, the fetch must run in the **page context** (so the Service Worker
  intercepts it). Every network call goes through `page.fetch` (`unsafeWindow.fetch` /
  `window.fetch`).
- Media URLs are discovered by polling `<video>`/`<audio>` `currentSrc` (the DOM is shared
  between worlds).
- Downloads use HTTP `Range` requests, chunked, then streamed to disk (File System Access) or
  concatenated into a Blob.

Developer / AI-agent details — in [`AGENTS.md`](./AGENTS.md).

## Project structure

```
tg-media-saver/
├── README.md                  # this file (English)
├── README.ru.md               # Russian version
├── AGENTS.md                  # context for developers and AI agents
├── LICENSE                    # MIT
├── CHANGELOG.md
├── package.json               # npm test (Node built-in runner, no deps)
├── .gitignore
├── tg-media-saver.user.js     # generated userscript (install into Tampermonkey)
├── src/
│   ├── content.js             # SINGLE source of logic
│   └── userscript.meta.js     # userscript header (template with __VERSION__)
├── extension/
│   ├── manifest.json          # MV3 manifest (icons, popup, content script)
│   ├── content.js             # generated copy of src/content.js
│   ├── popup.html / popup.css # toolbar help popup
│   └── icons/                 # icon16/48/128.png
├── assets/
│   ├── icon.svg               # vector icon source
│   └── icon128.png / icon512.png
├── scripts/
│   ├── build.sh               # build both distributables + zip
│   └── make_icons.py          # generate PNG icons (Pillow via uv)
├── test/                      # Node built-in test runner (no deps)
│   ├── helpers.js             # DOM shim for loading content.js in Node
│   ├── unit.test.js
│   ├── download.test.js
│   ├── content.test.js
│   └── build.test.js
├── .github/workflows/ci.yml   # GitHub Actions: npm test on push/PR
└── dist/                      # build output (not committed)
```

## Contributing

Bug reports and ideas — in [Issues](https://github.com/eiler2005/tg-media-saver/issues).
PRs welcome: edit [`src/content.js`](./src/content.js), run `./scripts/build.sh`, and make sure
`npm test` passes.

## License

[MIT](./LICENSE) © Denis Ermilov. Independent implementation; not a derivative of any existing
script.
