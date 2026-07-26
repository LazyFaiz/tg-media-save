# Troubleshooting

If something does not work, start here. For how the tool is built see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## First: confirm the script is actually running

Open DevTools → Console and filter by `TG Media Saver`. On a working install you should see:

```
[TG Media Saver] ready — play a video/audio, then press ⬇ (inline or bottom-left).
```

If there is **no** `[TG Media Saver]` line at all, the script is not running — see below.

## No buttons / no `[TG Media Saver]` logs

**Userscript:**
- Is the script **enabled** in Tampermonkey / Violentmonkey?
- On Chrome (Manifest V3): is Tampermonkey's **"Allow user scripts"** toggle enabled
  (`chrome://extensions` → Tampermonkey)? Without it, userscripts silently do not run.
- Hard-reload the Telegram tab (Cmd/Ctrl+Shift+R) after installing or editing.

**Extension:**
- Is the extension **enabled** in `chrome://extensions`?
- Chrome/Chromium **111+** is required (the manifest declares `minimum_chrome_version: "111"`
  for the MAIN-world content script).
- Did you load the folder that contains `manifest.json` (the `extension/` folder)?

## The button appears but nothing downloads

- Open DevTools → Console → filter `TG Media Saver` and read the error.
- Make sure the media **actually plays** in the browser. The tool can only save bytes the page
  itself can load — if the player never starts, there is no URL to fetch.

## Video won't play; console shows Service Worker errors

Symptoms: `FetchEvent … rejected`, `ERR_NETWORK_CHANGED`, `[MP-SERVICE] worker task error`,
`MEDIA_ELEMENT_ERROR: Empty src attribute`, `handleVideoLeak … leak`.

This means **Telegram's own pipeline is broken** (often after a network/VPN change), not the
extension. The page cannot play the media, so no userscript can download it. Fix, in order:

1. Stabilize the network / VPN.
2. Close **other** `web.telegram.org` tabs (the Service Worker is shared across tabs).
3. Hard-reload (Cmd/Ctrl+Shift+R).
4. Still broken → DevTools → Application → Service Workers → **Unregister** `sw-*` → reload.
   Do **not** enable "Bypass for network" — `/stream/` only works *through* the Service Worker.
5. Nuclear option → Application → Storage → **Clear site data** → log in to Telegram Web again.

## Updating after code changes

1. `./scripts/build.sh` (regenerates `tg-media-saver.user.js` and `extension/content.js`).
2. Userscript: re-paste the new `tg-media-saver.user.js` (or rely on `@updateURL` auto-update).
   Extension: in `chrome://extensions`, click the reload ↻ icon on the extension card.
3. Hard-reload the Telegram tab.
