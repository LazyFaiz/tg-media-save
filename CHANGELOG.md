# 1.0.2 (local fork)

- Retry transient fetch/body failures with bounded backoff.
- Bound Range requests and validate byte ranges and lengths before saving.
- Reset partial disk output when a server returns the full file.
- Refresh reused media URLs and improve failure diagnostics.
- Add a portable Python build and local installation guide.

# Changelog

All notable changes to **tg-media-save** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and the project
adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-07-26

### Added

- Test suite on Node's built-in runner (`npm test`, no dependencies): unit tests for the pure
  helpers, the core `download()` engine (Range chunking, blob concatenation, `blob:`/`data:`
  single-shot, "server ignores Range" fallback, error propagation), the content-script boot
  path, and end-to-end build/manifest validation.
- GitHub Actions CI (`.github/workflows/ci.yml`) running `npm test` on push/PR, with a CI badge
  in the README.
- Bilingual README: English base (`README.md`) + Russian (`README.ru.md`).

### Changed

- `download()` now returns the final file name **with extension** in every branch (previously
  the `blob:`/`data:` and no-`Range` branches returned the base name without extension).
- Renamed the internal stream-descriptor parser `describe` → `describeStream` (clearer; avoids
  clashing with test-framework globals) and exposed it, along with `download`, via a guarded
  `module.exports` test hook (no-op in browsers).

## [1.0.0] - 2026-07-26

### Added

- Initial public release.
- Save photos, videos, GIFs and voice messages from Telegram Web (`/k/` and `/z/`),
  including channels with "restrict saving content" enabled.
- Two distribution modes from a single source (`src/content.js`):
  - Tampermonkey / Violentmonkey **userscript** (`tg-media-save.user.js`);
  - **Chrome MV3 extension** (`extension/`, MAIN-world content script).
- Inline ⬇ buttons on feed media + floating ⬇ button with file name/size and progress.
- Real file names and extensions parsed from Telegram's `/stream/` descriptor.
- Streaming to disk via the File System Access API, with an in-memory Blob fallback.
- Toolbar help popup for the extension; generated PNG icons (16/48/128/512).
- Build tooling: `scripts/build.sh` (userscript + extension + store zip) and
  `scripts/make_icons.py` (Pillow via `uv`).
- Console helpers: `tgSaver.status()`, `tgSaver.downloadLast()`, `tgSaver.debug()`.
