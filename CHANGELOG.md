# Changelog

All notable changes to **TG Media Saver** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and the project
adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-26

### Added

- Initial public release.
- Save photos, videos, GIFs and voice messages from Telegram Web (`/k/` and `/z/`),
  including channels with "restrict saving content" enabled.
- Two distribution modes from a single source (`src/content.js`):
  - Tampermonkey / Violentmonkey **userscript** (`tg-media-saver.user.js`);
  - **Chrome MV3 extension** (`extension/`, MAIN-world content script).
- Inline ⬇ buttons on feed media + floating ⬇ button with file name/size and progress.
- Real file names and extensions parsed from Telegram's `/stream/` descriptor.
- Streaming to disk via the File System Access API, with an in-memory Blob fallback.
- Toolbar help popup for the extension; generated PNG icons (16/48/128/512).
- Build tooling: `scripts/build.sh` (userscript + extension + store zip) and
  `scripts/make_icons.py` (Pillow via `uv`).
- Console helpers: `tgSaver.status()`, `tgSaver.downloadLast()`, `tgSaver.debug()`.
