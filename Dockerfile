FROM oven/bun:1-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1

RUN bun run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install cloudflared binary
RUN apk add --no-cache wget && \
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

RUN adduser -D -h /home/bunjs -u 1001 bunjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=bunjs:bunjs /app/.next/standalone ./
COPY --from=builder --chown=bunjs:bunjs /app/.next/static ./.next/static

# Volumes — mount host paths at runtime:
#   -v ~/.cloudflared:/home/bunjs/.cloudflared  (cert.pem + credentials)
#   -v ~/.bettertunnels:/home/bunjs/.bettertunnels  (configs, logs, PIDs)
RUN mkdir -p /home/bunjs/.bettertunnels/configs /home/bunjs/.bettertunnels/logs && \
    chown -R bunjs:bunjs /home/bunjs/.bettertunnels

USER bunjs

EXPOSE 3000
ENV PORT=3000

CMD ["bun", "server.js"]
