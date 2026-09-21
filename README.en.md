# TG Media Save

[简体中文](README.md) | **English** | [Русский](README.ru.md)

Repository: [LazyFaiz/tg-media-save](https://github.com/LazyFaiz/tg-media-save). The installed extension is named **TG Media Save**; the project and distribution files use `tg-media-save`.

Based on [eiler2005/tg-media-saver](https://github.com/eiler2005/tg-media-saver), retaining the original attribution and [MIT license](LICENSE). Save only content your account can access and that you have the right to save. The tool does not send messages or collect data.

## Features

Adds download buttons for photos, videos, GIFs and voice messages in Telegram Web. Available as a Chrome / Edge MV3 extension and a Tampermonkey / Violentmonkey userscript, built from the same source. Not affiliated with Telegram.

- Inline media download buttons and a floating button at the bottom left for the last captured media.
- File names and sizes from valid document descriptors; ordinary Blobs use generated file names.
- WebK HLS / MediaSource original-file resolution, range downloads and transient-error retries.
- No login, posting or messaging on your behalf, no data collection, and no third-party runtime dependencies.

## Current version: 1.0.5

On 2026-09-21, the user confirmed successful downloading of the previously failing Telegram WebK video. Its MediaSource player overwrote the original HLS URL with a `blob:` URL; version 1.0.5 records the source before that happens and downloads the corresponding original file.

49 automated tests passed. This manual confirmation covers the reported video case, not every client, media type or userscript environment.

## Installation

1. [Download the extension ZIP](https://github.com/LazyFaiz/tg-media-save/raw/main/dist/tg-media-save-extension.zip) and extract it, or use the repository's `extension/` folder directly.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge and enable Developer mode.
3. Disable the old TG Media Saver and duplicate scripts that provide the same function.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. **Refresh Telegram, then reopen and play the video**, and click its download button.

For the userscript, use [tg-media-save.user.js](tg-media-save.user.js). Use either the extension or the userscript, not both. The script has no explicit `@updateURL` / `@downloadURL`; reinstall the version from this repository when upgrading rather than relying on automatic updates.

## Usage

1. Open Telegram Web and play the video/audio or open the image so the page loads the media.
2. Click the inline download button, or the floating button at the bottom left to save the last captured media.
3. If the browser shows a save dialog, choose a location and wait for the download to finish.

Respect Telegram's terms of service and the content owner's copyright.

## Updating

1. Get the latest source or package and update the folder actually loaded by the browser.
2. Reload **TG Media Save** in the extension manager and confirm version **1.0.5**.
3. **Refresh Telegram, then reopen the video.** Reloading only the extension cannot capture media sources already created in the old page.
4. Play the media and click download.

## Download behavior and limitations

- WebK HLS / MediaSource: records the original source per media element and converts valid same-origin HLS document URLs to stream requests. It does not guess the video from the latest network request.
- Ordinary Blobs: retains file references at creation, allowing files to be saved after their URLs are revoked. Retention is limited to 32 entries, 512 MiB total and five minutes per entry. Older entries are evicted when limits are exceeded; oversized files are not retained.
- Range downloads: requests at most 1 MiB at a time, makes up to three attempts for transient network errors, and validates ranges, byte counts and total size.
- Writes chunks to disk when the File System Access API is available; otherwise assembles the file in memory. Ordinary Blob saves use the browser download mechanism.
- MediaSource is not an ordinary file. Without a captured original source, its blob cannot be downloaded directly. Changes to the player implementation may affect compatibility.

## Troubleshooting

First confirm you refreshed the page and reopened the video. If downloading still fails, run this in the DevTools Console **on the Telegram page**:

```js
JSON.stringify(tgSaver.diagnose())
```

The output includes the version, capture status, cache size and media source categories, without complete media URLs or message contents.

| Field | Meaning |
|---|---|
| `sourceCaptureInstalled` | Whether original-source capture was installed |
| `blobCaptureInstalled` | Whether Blob / MediaSource type capture was installed |
| `sourceType: "stream"` | A file download source was resolved |
| `capturedType: "MediaSource"` | A player object was captured, but no original file source is currently resolved |
| `capturedType: "not-retained"` | The URL is not cached; this is normal for a stream source |
| `readyState: 0` | The element has not loaded media; idle elements may coexist with a playing video |

Include diagnostics, the error text and whether playback works when reporting a problem. `Failed to fetch` alone cannot distinguish network errors, revoked Blobs and MediaSource. If playback also fails, restore the network and refresh Telegram. Do not enable Service Worker **Bypass for network**. See [Troubleshooting](docs/TROUBLESHOOTING.md).

## Development

Requires Node.js 18+ and Python 3 (`python` in PATH). There are no third-party runtime dependencies.

```sh
npm run build
npm test
```

Edit only `src/content.js` for runtime logic; the build generates the extension script, userscript and ZIP. The version comes from `extension/manifest.json`. `scripts/build.sh` is a compatibility entry point that calls `python3 scripts/build.py`.

[Architecture](docs/ARCHITECTURE.md) · [Tests](test/README.md) · [Changelog](CHANGELOG.md)
