#!/usr/bin/env bash
set -euo pipefail

# Entry point for the CI deploy key. It is pinned in root's authorized_keys via
# command="...", so this is the only thing that key can do: no shell, no
# arbitrary commands, no port forwarding. Whatever the client asks to run is
# ignored; the payload is the tarball on stdin.
#
# Expected stdin: gzipped tar whose root contains standalone/ and static/,
# i.e. the layout produced by the release workflow's "Assemble bundle" step.

STAGE_DIR="${STAGE_DIR:-/home/kyle/hunterdoc-stage}"
APP_DIR="${APP_DIR:-/www/wwwroot/hunterdoc}"
LOG="/var/log/hunterdoc-ci-deploy.log"

exec > >(tee -a "$LOG") 2>&1
echo "=== $(date -Is) deploy started from ${SSH_CLIENT%% *} ==="

incoming="$(mktemp -d)"
cleanup() { rm -rf "$incoming"; }
trap cleanup EXIT

# Read the bundle before touching the live staging directory, so a truncated
# upload cannot leave a half-replaced bundle behind.
tar xzf - -C "$incoming"

if [ ! -f "$incoming/standalone/server.js" ] || [ ! -d "$incoming/static" ]; then
  echo "rejected: bundle must contain standalone/server.js and static/"
  exit 1
fi

rm -rf "${STAGE_DIR:?}"
mkdir -p "$STAGE_DIR"
mv "$incoming/standalone" "$incoming/static" "$STAGE_DIR/"
chown -R kyle:kyle "$STAGE_DIR"

echo "bundle staged, running deploy"
bash "${APP_DIR}/deploy/server-deploy.sh"
echo "=== $(date -Is) deploy finished ==="
