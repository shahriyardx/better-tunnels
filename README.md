# BetterTunnels

A self-hosted Cloudflare Tunnel manager — create, start, stop, and monitor Cloudflare Tunnels from a web dashboard.

## Prerequisites

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) installed and authenticated (`cloudflared tunnel login`)
- [Docker](https://docs.docker.com/engine/install/) (for Postgres)
- [Bun](https://bun.sh/) or Node.js 20+
- A Cloudflare account with at least one zone (domain)

## Getting Started

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
bun install
```

### 3. Set up the database

```bash
bun run db:generate
bun run db:push
```

### 4. Authenticate cloudflared

```bash
cloudflared tunnel login
```

This creates `~/.cloudflared/cert.pem` with credentials for Cloudflare API access.

### 5. Run the dev server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) — app detects cloudflared and redirects to dashboard.

## How Tunnels Work

1. **Create** — `cloudflared tunnel create` registers tunnel with Cloudflare
2. **DNS** — CNAME record created in the selected zone pointing to `{tunnel-id}.cfargotunnel.com`
3. **Config** — `--config` YAML written to `~/.bettertunnels/configs/{tunnel-id}.yml`
4. **Start** — Daemon spawned detached with `--protocol http2`, PID tracked in `~/.bettertunnels/pids.json`
5. **Logs** — stdout/stderr captured to `~/.bettertunnels/logs/{tunnel-id}.log`
6. **Stop** — SIGTERM sent to stored PID
7. **Status** — PID verified via `/proc/{pid}/comm` to prevent false positives from PID reuse

## Docker

### Prerequisites

cloudflared **must be authenticated on the host** before running the container:

```bash
cloudflared tunnel login   # creates ~/.cloudflared/cert.pem
```

Login opens a browser — can't do this inside the container.

### Build & Run

```bash
# Build the image
docker build -t bettertunnels .

# Run with host cloudflared credentials mounted
docker run -d \
  -p 3000:3000 \
  -v ~/.cloudflared:/home/bunjs/.cloudflared \
  -v ~/.bettertunnels:/home/bunjs/.bettertunnels \
  --add-host host.docker.internal:host-gateway \
  bettertunnels
```

The container needs two host mounts:

| Host path | Container path | Purpose |
|-----------|---------------|---------|
| `~/.cloudflared` | `/home/bunjs/.cloudflared` | `cert.pem` + tunnel credentials (`{id}.json`) |
| `~/.bettertunnels` | `/home/bunjs/.bettertunnels` | Tunnel configs, logs, PID data |

`--add-host host.docker.internal:host-gateway` lets tunnels route to services on the host (e.g. `localhost:8080` → `host.docker.internal:8080`).

### Environment

No `.env` file needed — cloudflared's `cert.pem` provides API credentials. Postgres defaults to `postgres://postgres:postgres@localhost:5432/postgres`. For a containerized Postgres, use Docker Compose:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
  bettertunnels:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ~/.cloudflared:/home/bunjs/.cloudflared
      - ~/.bettertunnels:/home/bunjs/.bettertunnels
    depends_on:
      - postgres
