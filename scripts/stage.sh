#!/usr/bin/env bash
# Copies only what the browser needs into dist/ (no raw dumps, tests, git).
# Then: ~/tools/preview/publish.sh filword ~/tools/filword/dist
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
cp -r index.html style.css sw.js manifest.webmanifest icons src data dist/
# Compressed dictionary: 4.6 MB -> ~1.2 MB, unpacked in the browser.
gzip -9 -c data/words.json > dist/data/words.json.gz
gzip -9 -c data/bonus.json > dist/data/bonus.json.gz
echo "dist: $(du -sh dist | cut -f1)"
