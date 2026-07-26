# TG Media Saver

[![CI](https://github.com/eiler2005/tg-media-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/eiler2005/tg-media-saver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-229ed9.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.1-229ed9.svg)](./CHANGELOG.md)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-229ed9.svg)](https://developer.chrome.com/docs/extensions/mv3)

**Русский → [README.ru.md](./README.ru.md)**

Save **photos, videos, GIFs and voice messages** from [Telegram Web](https://web.telegram.org)
(the `/k/` and `/z/` clients) — including channels with **"Restrict saving content"** enabled.
One source, two distribution modes: a Tampermonkey userscript and a Chrome MV3 extension.
Not affiliated with Telegram.

> ⚠️ **Responsible use.** The tool only works with what your account can already see in Telegram.
> Use it only for content you have the rights to. Respect Telegram's Terms of Service and content
> owners' copyright.

## Features

- ⬇ save button right on videos/photos **in the chat feed**, plus a floating ⬇ (bottom-left).
- Real file **names and sizes**, parsed from Telegram's stream descriptor.
- Large files stream **straight to disk** (File System Access API) with an in-memory fallback.
- Bypasses Telegram's strict CSP; **no permissions** beyond `web.telegram.org`; collects nothing.

## Install

### Mode 1 — Userscript (Tampermonkey / Violentmonkey)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. **Chrome (MV3):** enable Tampermonkey's **"Allow user scripts"** in `chrome://extensions`.
3. Install — **one click:** open
   [`tg-media-saver.user.js`](https://raw.githubusercontent.com/eiler2005/tg-media-saver/main/tg-media-saver.user.js);
   or **manually:** paste its contents into a new script.
4. Hard-reload Telegram (Cmd/Ctrl+Shift+R).

### Mode 2 — Chrome extension (MV3, Chrome 111+)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the [`extension/`](./extension) folder (the one with
   `manifest.json`). To build from source first, see
   [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#building-from-source).
3. Hard-reload Telegram (Cmd/Ctrl+Shift+R).

> Use **one mode at a time** (otherwise the buttons duplicate). The extension is not blocked by
> the page CSP and needs no "Allow user scripts" toggle.

## Usage

1. **Play** the video/audio (or open the photo) so the page loads the media.
2. Click ⬇ **on the media** — or the floating ⬇ bottom-left.
3. The file saves with its real name; progress shows as a percent.

Console helpers: `tgSaver.status()`, `tgSaver.downloadLast()`, `tgSaver.debug(true)`.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — how it works (diagrams), build pipeline, project structure.
- [Tests](./test/README.md) — what is tested and how (`npm test`, no dependencies).
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — no buttons, Service Worker errors, etc.
- [AGENTS.md](./AGENTS.md) — notes for developers and AI agents.
- [Changelog](./CHANGELOG.md).

## Contributing

Bug reports and ideas — in [Issues](https://github.com/eiler2005/tg-media-saver/issues).
PRs welcome: edit [`src/content.js`](./src/content.js), run `./scripts/build.sh`, and make sure
`npm test` passes.

## License

[MIT](./LICENSE)
