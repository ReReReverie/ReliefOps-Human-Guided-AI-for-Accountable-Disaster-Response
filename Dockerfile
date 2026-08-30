# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# Keep the package manager version aligned with the repository documentation.
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# Keep the repository's safe, non-interactive install policy in containers.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public

# Next can evaluate server modules while collecting route metadata. These are
# generated build-only values; runtime secrets are supplied by Compose.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    DATABASE_URL_UNPOOLED=postgresql://build:build@127.0.0.1:5432/build \
    NEON_AUTH_COOKIE_SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')" \
    REPORTER_SESSION_PEPPER="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')" \
    LOCAL_DEV=true \
    LOCAL_AUTH_BYPASS=true \
    AI_PROVIDER=mock \
    pnpm build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 reliefops \
  && useradd --system --uid 1001 --gid reliefops reliefops

RUN mkdir -p /app/public
COPY --from=builder --chown=reliefops:reliefops /app/public ./public
COPY --from=builder --chown=reliefops:reliefops /app/.next/standalone ./
COPY --from=builder --chown=reliefops:reliefops /app/.next/static ./.next/static
COPY --chown=reliefops:reliefops docker/entrypoint.sh /usr/local/bin/reliefops-entrypoint

RUN chmod 0555 /usr/local/bin/reliefops-entrypoint

USER reliefops
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/reliefops-entrypoint"]
CMD ["node", "server.js"]
