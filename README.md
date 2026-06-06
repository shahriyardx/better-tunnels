# BetterTunnels

A self-hosted Cloudflare Tunnel manager — create, start, stop, and monitor Cloudflare Tunnels from a web dashboard.

## Getting Started

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Install & setup

```bash
bun install
bun run db:push
```

### 3. Authenticate cloudflared

```bash
cloudflared tunnel login
```

Opens a browser to authenticate with Cloudflare. Creates `~/.cloudflared/cert.pem`.

### 4. Run

```bash
bun dev
```

Open [http://localhost:5730](http://localhost:5730).

## How Tunnels Work

1. **Create** — `cloudflared tunnel create` registers tunnel with Cloudflare
2. **DNS** — CNAME record created in the selected zone pointing to `{tunnel-id}.cfargotunnel.com`
3. **Config** — `--config` YAML written to `~/.bettertunnels/configs/{tunnel-id}.yml`
4. **Start** — Daemon spawned detached with `--protocol http2`, PID tracked in `~/.bettertunnels/pids.json`
5. **Logs** — stdout/stderr captured to `~/.bettertunnels/logs/{tunnel-id}.log`
6. **Stop** — SIGTERM sent to stored PID
7. **Status** — PID verified via `/proc/{pid}/comm` to prevent false positives from PID reuse

