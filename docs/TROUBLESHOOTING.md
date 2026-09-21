# Troubleshooting

Installed extension name: **TG Media Save**. Current version: **1.0.5**.
See the [Chinese guide](../README.md) for installation and diagnosis.

## Update first

Update the folder actually loaded by the browser, reload the extension, then **refresh Telegram and reopen the video**. Source capture starts at document startup and cannot recover assignments that already happened. Use only one extension/userscript installation.

For source changes run `npm run build` (Node.js and Python 3). Reinstall the generated userscript manually; this fork has no explicit `@updateURL` or `@downloadURL`.

## No buttons

Check that the extension is enabled and loaded from the folder containing `manifest.json`. The manifest requires Chrome/Chromium 111+. Userscript users should check their manager is enabled and its browser user-script permission is allowed. Refresh Telegram after installation.

## Playback works, but blob download fails

`Failed to fetch` or `ERR_FILE_NOT_FOUND` does not by itself prove a network or Service Worker fault. A blob URL can refer to a revoked file Blob or to a MediaSource player, which is not a file.

Version 1.0.5 records WebK's per-element HLS source before the player overwrites it with a MediaSource blob. The user confirmed successful downloading of the previously failing WebK video on 2026-09-21. Other videos, clients and userscript environments are not implied to be verified.

Ordinary file Blobs are retained separately: at most 32 entries, 512 MiB total, and five minutes per entry. Oversized Blobs are not cached. This does not change Telegram's own URL revocation behavior.

## Collect diagnostics

In the Telegram page's DevTools Console run:

```js
JSON.stringify(tgSaver.diagnose())
```

Include this output, the error text and whether playback works in a bug report. Diagnostics contain version, hook availability, source categories and sizes, not complete media URLs or message contents.

- `sourceCaptureInstalled`: the per-element source setter hook was installed.
- `blobCaptureInstalled`: the object URL capture hook was installed.
- `sourceType: "stream"`: a file source was resolved; `capturedType: "not-retained"` is normal for this path.
- `capturedType: "MediaSource"` with `sourceType: "blob"`: no original file URL was resolved for this player.
- `readyState: 0`: an unloaded element; idle elements can coexist with a playing video.

Hook installation alone does not prove that a particular source was captured. Reloading the page and reopening the video are required after upgrades.

## Playback also fails

Restore the network/VPN and refresh Telegram. If Service Worker errors persist, close other Telegram tabs and retry. Do not enable **Bypass for network**: Telegram's stream endpoint relies on its Service Worker. This extension does not reset sessions or repair Telegram's transport.

For developers: [architecture](ARCHITECTURE.md) and [tests](../test/README.md).
