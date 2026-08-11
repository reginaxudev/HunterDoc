#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Applying database schema..."
  ./node_modules/.bin/prisma db push --skip-generate
fi

if [ "$RUN_DB_SEED" = "true" ]; then
  echo "[entrypoint] Seeding team accounts..."
  if [ -f prisma/seed.ts ]; then
    node --experimental-strip-types prisma/seed.ts
  else
    echo "[entrypoint] seed.ts not found, skip"
  fi
fi

echo "[entrypoint] Starting Next.js server..."
exec node server.js
