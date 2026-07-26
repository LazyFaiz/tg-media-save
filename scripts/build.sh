#!/usr/bin/env bash
#
# Build TG Media Saver distributables from the single source of truth (src/content.js).
#
#   ./scripts/build.sh
#
# Produces:
#   tg-media-saver.user.js            — Tampermonkey/Violentmonkey userscript (version injected)
#   extension/content.js              — copy of src/content.js used by the Chrome extension
#   dist/tg-media-saver-extension.zip — store-ready zip of the extension (manifest at archive root)
#
# The version is read from extension/manifest.json (single source of truth for versioning).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Preflight: fail fast with a clear message if a required tool is missing.
for cmd in python3 zip; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: '$cmd' is required but not installed." >&2
    exit 1
  }
done

VERSION="$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")"
echo "Building TG Media Saver v${VERSION}"

# 1) Userscript = header (with version injected) + content
sed "s/__VERSION__/${VERSION}/g" src/userscript.meta.js > tg-media-saver.user.js
cat src/content.js >> tg-media-saver.user.js
echo "  ✓ tg-media-saver.user.js"

# 2) Extension content script (single source of truth copied in)
cp src/content.js extension/content.js
echo "  ✓ extension/content.js"

# 3) Store-ready zip (manifest.json must be at the archive root)
mkdir -p dist
rm -f dist/tg-media-saver-extension.zip
( cd extension && zip -qr ../dist/tg-media-saver-extension.zip manifest.json content.js popup.html popup.css icons )
echo "  ✓ dist/tg-media-saver-extension.zip"

echo "Done."
