#!/usr/bin/env bash
# Publishes the game to https://filword.michaelperov.com/.
# Builds dist/, keeps a backup of what is live now, then syncs.
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET=/var/www/filword.michaelperov.com
BACKUPS="$HOME/backups/filword"

[ -d "$TARGET" ] && [ -w "$TARGET" ] || { echo "no writable $TARGET (root: mkdir + chown edgelab)" >&2; exit 1; }
node --test test/*.test.mjs > /dev/null || { echo "tests fail - not deploying" >&2; exit 1; }
./scripts/stage.sh

# Backup of the live version; the last 5 are kept.
mkdir -p "$BACKUPS"
if [ -n "$(ls -A "$TARGET")" ]; then
  tar czf "$BACKUPS/filword-$(date +%Y%m%d-%H%M%S).tar.gz" -C "$TARGET" .
  ls -1t "$BACKUPS"/filword-*.tar.gz | tail -n +6 | xargs -r rm --
fi

# --delete: files removed from the game disappear from the site too.
rsync -a --delete dist/ "$TARGET/"
echo "live: https://filword.michaelperov.com/"
