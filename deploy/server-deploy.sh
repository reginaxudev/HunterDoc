#!/usr/bin/env bash
set -euo pipefail

# Deploy a prebuilt Next standalone bundle on the baota host.
#
# The bundle is produced elsewhere (locally today, GitHub Actions later) and
# staged in STAGE_DIR. This script only assembles, migrates and restarts, so
# the build source can change without touching it.
#
# Usage (as root):
#   bash deploy/server-deploy.sh                assemble + migrate + restart
#   bash deploy/server-deploy.sh --skip-db      skip prisma db push
#
# Expected layout in STAGE_DIR:
#   standalone/   the .next/standalone tree, already containing server.js
#   static/       the .next/static tree
#
# APP_DIR keeps the source checkout and its node_modules, which is where the
# prisma CLI and the collaboration server come from. The standalone bundle is
# self-contained and lives under APP_DIR/.next/standalone.
#
# Both .env.production and .env must exist in APP_DIR with the same
# AUTH_SECRET: the app signs collab tokens, the collaboration server verifies
# them, and the PartyKit CLI only reads .env.

APP_DIR="${APP_DIR:-/www/wwwroot/hunterdoc}"
STAGE_DIR="${STAGE_DIR:-/home/kyle/hunterdoc-stage}"
NODE_BIN="${NODE_BIN:-/www/server/nodejs/v22.22.1/bin}"
RUN_USER="${RUN_USER:-www}"
APP_PORT="${APP_PORT:-3100}"

SKIP_DB=0
[[ "${1:-}" == "--skip-db" ]] && SKIP_DB=1

export PATH="${NODE_BIN}:${PATH}"

info() { echo -e "\033[0;36m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[0;32m[ OK ]\033[0m $*"; }
fail() { echo -e "\033[0;31m[FAIL]\033[0m $*"; exit 1; }

STANDALONE_DST="${APP_DIR}/.next/standalone"

[[ -f "$STAGE_DIR/standalone/server.js" ]] || fail "missing server.js in $STAGE_DIR/standalone"
[[ -d "$STAGE_DIR/static" ]] || fail "missing $STAGE_DIR/static"
[[ -f "$APP_DIR/.env.production" ]] || fail "missing $APP_DIR/.env.production"

info "assembling into $STANDALONE_DST"
mkdir -p "$STANDALONE_DST" "$APP_DIR/logs" "$APP_DIR/public/uploads"

# Replace the standalone tree wholesale so deleted files do not linger.
rsync -a --delete "$STAGE_DIR/standalone/" "$STANDALONE_DST/"

# next build does not copy these into standalone; they must be placed by hand,
# and they belong under the standalone tree because server.js chdirs into it.
rsync -a --delete "$STAGE_DIR/static/" "$STANDALONE_DST/.next/static/"
mkdir -p "$STANDALONE_DST/public"
rsync -a "$APP_DIR/public/" "$STANDALONE_DST/public/"
ok "assembled"

if [[ "$SKIP_DB" -eq 0 ]]; then
  if [[ -x "$APP_DIR/node_modules/.bin/prisma" ]]; then
    info "applying database schema"
    (cd "$APP_DIR" && set -a && . ./.env.production && set +a && \
      ./node_modules/.bin/prisma db push --skip-generate)
    ok "schema applied"
  else
    info "prisma CLI not found in $APP_DIR/node_modules, skipping db push"
  fi
fi

chown -R "${RUN_USER}:${RUN_USER}" "$APP_DIR"

info "restarting processes"
if pm2 describe hunterdoc > /dev/null 2>&1; then
  pm2 reload hunterdoc --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs" --only hunterdoc
fi
pm2 save > /dev/null

info "waiting for health check on ${APP_PORT}"
for i in $(seq 1 30); do
  if curl -sf -m 3 "http://127.0.0.1:${APP_PORT}/api/health" > /dev/null 2>&1; then
    ok "healthy after ${i}s"
    exit 0
  fi
  sleep 1
done

fail "health check did not pass within 30s; check: pm2 logs hunterdoc"
