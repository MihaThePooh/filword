#!/usr/bin/env bash
# Publishes the game to https://filword.michaelperov.com/ (spb-node, hub).
# Tests, builds dist/, keeps a backup of what is live now on the node, then syncs.
# The save service lives in the hub repo (services/filword), nginx config too
# (deploy/nginx/filword.conf).
set -euo pipefail
cd "$(dirname "$0")/.."
NODE=spb-node
TARGET=/srv/filword
BACKUPS='~/backups/filword'

node --test test/*.test.mjs > /dev/null || { echo "tests fail - not deploying" >&2; exit 1; }
./scripts/stage.sh

# Backup of the live version on the node; the last 5 are kept.
ssh "$NODE" "mkdir -p $BACKUPS && if [ -n \"\$(ls -A $TARGET 2>/dev/null)\" ]; then tar czf $BACKUPS/filword-\$(date +%Y%m%d-%H%M%S).tar.gz -C $TARGET . && ls -1t $BACKUPS/filword-*.tar.gz | tail -n +6 | xargs -r rm --; fi"

# --delete: files removed from the game disappear from the site too.
rsync -a --delete dist/ "$NODE:$TARGET/"
echo "live: https://filword.michaelperov.com/"
