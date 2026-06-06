# BetterTunnels

A self-hosted Cloudflare Tunnel manager — create, start, stop, and monitor Cloudflare Tunnels from a web dashboard.

## Features

- **Create tunnels** with custom domain, target host, and port
- **Multi-domain support** — select from any Cloudflare zone on your account
- **DNS via API** — CNAME records created/patched via Cloudflare REST API (no CLI routing)
- **Live logs** — per-tunnel log capture with 2s polling on the detail page
- **Dark mode** — next-themes, default dark, toggle in sidebar
- **Process management** — detached cloudflared daemons with PID tracking and health checks
- **Status reconciliation** — checks running PIDs against DB state

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

Open [http://localhost:3000](http://localhost:3000) — the app detects cloudflared and redirects to the dashboard.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Postgres 17 (via Docker) |
| ORM | Drizzle ORM + drizzle-kit |
| UI | shadcn/ui + Radix + Tailwind CSS 4 |
| Forms | react-hook-form + zod v4 |
| Icons | Phosphor Icons |
| Theme | next-themes |
| Tunnels | cloudflared CLI (child_process spawn) |
| DNS | Cloudflare REST API (zones, dns_records) |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── domains/route.ts    # Cloudflare zones list
│   │   ├── tunnels/            # CRUD, start/stop, logs, reconcile
│   │   └── user/route.ts       # Account info from cert.pem
│   ├── dashboard/
│   │   ├── layout.tsx          # Shared sidebar layout
│   │   ├── page.tsx            # Overview (stats, account, zones)
│   │   ├── new/page.tsx        # Create tunnel form
│   │   ├── tunnels/
│   │   │   ├── page.tsx        # Tunnel list
│   │   │   └── [id]/page.tsx   # Tunnel detail + live logs
│   ├── layout.tsx              # Root layout (theme, fonts)
│   └── page.tsx                # Landing / setup check
├── components/
│   ├── app-sidebar.tsx         # Sidebar with nav + theme toggle
│   ├── nav-main.tsx            # Navigation items
│   └── ui/                     # shadcn components
├── db/
│   ├── schema.ts               # Drizzle schema
│   └── index.ts                # DB client
└── lib/
    ├── cloudflared.ts          # CLI wrapper, DNS API, process manager
    ├── navigation.tsx          # Nav link definitions
    └── utils.ts                # cn() helper
```

## Scripts

| Command | Action |
|---------|--------|
| `bun dev` | Start dev server |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run lint` | Check with Biome |
| `bun run format` | Format with Biome |

## How Tunnels Work

1. **Create** — `cloudflared tunnel create` registers tunnel with Cloudflare
2. **DNS** — CNAME record created in the selected zone pointing to `{tunnel-id}.cfargotunnel.com`
3. **Config** — `--config` YAML written to `~/.cloudtunnel/configs/{tunnel-id}.yml`
4. **Start** — Daemon spawned detached with `--protocol http2`, PID tracked in `~/.cloudtunnel/pids.json`
5. **Logs** — stdout/stderr captured to `~/.cloudtunnel/logs/{tunnel-id}.log`
6. **Stop** — SIGTERM sent to stored PID
7. **Status** — PID verified via `/proc/{pid}/comm` to prevent false positives from PID reuse

## Environment

No `.env` file needed — cloudflared's `cert.pem` provides API credentials. Postgres defaults to `postgres://postgres:postgres@localhost:5432/postgres`.
