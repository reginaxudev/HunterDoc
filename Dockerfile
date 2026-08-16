FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# schema is needed here: package.json postinstall runs `prisma generate`
COPY prisma ./prisma
RUN npm ci

# Self-contained Prisma CLI tree for the entrypoint's `prisma db push`.
# Cherry-picking node_modules/prisma out of the app tree drops its transitive
# deps (@prisma/config -> c12 / deepmerge-ts / effect / empathic ...), so the
# CLI is installed on its own, pinned to the version in package-lock.json.
FROM node:22-alpine AS prisma-cli
WORKDIR /cli
COPY package-lock.json ./
RUN PRISMA_VERSION="$(node -p 'require("./package-lock.json").packages["node_modules/prisma"].version')" \
  && rm package-lock.json \
  && npm init -y > /dev/null \
  && npm install --omit=dev --no-audit --no-fund "prisma@${PRISMA_VERSION}"

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999
ARG NEXT_PUBLIC_SYNC_ENABLED=false
ARG NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS=5000

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_PARTYKIT_HOST=$NEXT_PUBLIC_PARTYKIT_HOST
ENV NEXT_PUBLIC_SYNC_ENABLED=$NEXT_PUBLIC_SYNC_ENABLED
ENV NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS=$NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/headhunter"

RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && apk add --no-cache tini wget

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=prisma-cli /cli/node_modules ./node_modules
# after the CLI tree, so the client generated in builder wins on @prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/config ./config
COPY --from=builder /app/lib/auth/password.ts ./lib/auth/password.ts
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh

# .bin/prisma must be recreated as a symlink: COPY dereferences it into a plain
# file, and build/index.js then resolves its sibling .wasm assets against .bin/
RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/node_modules/.bin \
  && ln -sf ../prisma/build/index.js /app/node_modules/.bin/prisma \
  && mkdir -p /app/public/uploads \
  && chown -R nextjs:nodejs /app/public/uploads /app/prisma /app/config /app/lib /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
