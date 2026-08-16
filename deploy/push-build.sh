#!/usr/bin/env bash
set -euo pipefail

# Build the app with production settings and stage the artifacts on the server.
#
# Run this on the build machine (a laptop today, a CI runner later). It never
# touches the running deployment: it only fills STAGE_DIR, after which
# deploy/server-deploy.sh must be run on the server as root.
#
# Usage:
#   bash deploy/push-build.sh              build, then stage
#   bash deploy/push-build.sh --no-build   stage an existing .next
#
# The NEXT_PUBLIC_* values are inlined at build time, so they are set here
# rather than read from the server's .env.production. Changing any of them
# requires a rebuild, not just a restart.

SSH_HOST="${SSH_HOST:-cloud}"
STAGE_DIR="${STAGE_DIR:-/home/kyle/hunterdoc-stage}"

export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://hunterdoc.expture.cn}"
export NEXT_PUBLIC_PARTYKIT_HOST="${NEXT_PUBLIC_PARTYKIT_HOST:-hunterdoc.expture.cn}"
export NEXT_PUBLIC_SYNC_ENABLED="${NEXT_PUBLIC_SYNC_ENABLED:-false}"
export NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS="${NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS:-5000}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

info() { echo -e "\033[0;36m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[0;32m[ OK ]\033[0m $*"; }
fail() { echo -e "\033[0;31m[FAIL]\033[0m $*"; exit 1; }

if [[ "${1:-}" != "--no-build" ]]; then
  info "building with APP_URL=$NEXT_PUBLIC_APP_URL PARTYKIT_HOST=$NEXT_PUBLIC_PARTYKIT_HOST"
  npm run build
fi

[[ -f .next/standalone/server.js ]] || fail "no standalone output; is output:'standalone' still set in next.config.ts?"

# The engine must match the server platform, not the build machine. See the
# binaryTargets entry in prisma/schema.prisma.
if ! ls .next/standalone/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node > /dev/null 2>&1; then
  fail "rhel prisma engine missing from the bundle; run npx prisma generate and rebuild"
fi
ok "rhel prisma engine present"

info "staging to ${SSH_HOST}:${STAGE_DIR}"
ssh "$SSH_HOST" "mkdir -p ${STAGE_DIR}/standalone ${STAGE_DIR}/static"

# @img is sharp's platform-specific build. It is macOS-only here and the app
# never calls it (no next/image usage), so shipping it would only waste 16MB
# and mislead anyone reading the deployed tree.
rsync -az --delete --exclude "node_modules/@img" \
  .next/standalone/ "${SSH_HOST}:${STAGE_DIR}/standalone/"
rsync -az --delete .next/static/ "${SSH_HOST}:${STAGE_DIR}/static/"

ok "staged"
echo
echo "Now run this on the server as root:"
echo "  bash /www/wwwroot/hunterdoc/deploy/server-deploy.sh"
