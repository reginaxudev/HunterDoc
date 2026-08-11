#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Applying database schema..."
  ./node_modules/.bin/prisma db push --skip-generate
fi

echo "[entrypoint] Starting Next.js server..."
exec node server.js
