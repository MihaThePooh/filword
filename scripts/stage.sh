#!/usr/bin/env bash
# Copies only what the browser needs into dist/ (no raw dumps, tests, git).
# Then: ~/tools/preview/publish.sh filword ~/tools/filword/dist
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
cp -r index.html style.css src data dist/
echo "dist: $(du -sh dist | cut -f1)"
