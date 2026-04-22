# Local Docker development (Postgres + Supabase Storage)

This repository includes two complementary pieces for backend development:

1. **PostgreSQL in Docker** — the application database used by Prisma (`docker-compose.yml`, service `dashboardpostgres`).
2. **Local Supabase** — the Storage API and buckets used for CRM MMS attachments and appointment uploads (`supabase/` + Supabase CLI).

They run as separate processes: Prisma talks to Postgres on port **5432**; the server’s Supabase client talks to the local API on **54321** (defaults from `supabase/config.toml`).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Windows/macOS, or Docker Engine on Linux)
- [Node.js](https://nodejs.org/) (includes `npx`, used to run the Supabase CLI without a global install)

## One-command setup

From the **repository root**:

```bash
npm run dev:docker
```

This script:

1. Verifies Docker is reachable.
2. Runs `docker compose up -d` to start (or recreate) the `dashboardpostgres` container with database `mydb`.
3. Runs `npx supabase start` to start the local Supabase stack, including Storage and the buckets declared in `supabase/config.toml` (`messaging`, `appointment`).

When it finishes, it prints a block you can paste into `server/.env` for development.

### Regenerate only the Supabase env lines

If Postgres and Supabase are already running and you only need the current API URL and service role key:

```bash
npm run dev:docker:env
```

### Stop the Supabase stack

```bash
npm run dev:docker:stop
```

Postgres started via Docker Compose is not stopped by this command; use `docker compose down` if you want to stop it too.

## What to put in `server/.env`

Copy from `server/.env.example` and set at least:

| Variable | Local development |
|----------|-------------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/mydb` |
| `SUPABASE_URL` | `http://127.0.0.1:54321` (unless you changed `[api].port` in `supabase/config.toml`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Output of `npm run dev:docker:env` (or the `dev:docker` script) |
| `SUPABASE_STORAGE_BUCKET` | `messaging` |
| `SUPABASE_STORAGE_BUCKET_APPOINTMENT` | `appointment` |

Then run migrations and seed as usual from `server/` (e.g. `npx prisma migrate dev`, `npx prisma db seed`).

## Supabase Studio

With the stack running, you can open Supabase Studio (default **http://127.0.0.1:54323**) to inspect Storage buckets and objects. Exact URLs and ports may differ if you edited `supabase/config.toml`; run `npx supabase status` for the current values.

## Troubleshooting

### `Bind for 0.0.0.0:54322 failed: port is already allocated` (or similar)

Another process—or another local Supabase project—is using the same port. Options:

- Stop other stacks: `npm run dev:docker:stop`, or `npx supabase stop` from another project that uses those ports.
- Change ports in `supabase/config.toml` (for example `[db].port` for the internal Supabase Postgres, `[api].port` for the API), then run `npm run dev:docker` again. Update `SUPABASE_URL` in `.env` to match the API port.

### `dashboardpostgres` fails to start on 5432

Something else is using **5432**. Stop that service or change the host mapping in `docker-compose.yml` (e.g. `5433:5432`) and set `DATABASE_URL` accordingly.

### Storage errors after changing buckets

Bucket definitions live in `supabase/config.toml`. After editing them, restart the stack (`npx supabase stop` then `npm run dev:docker`) so local buckets stay in sync.

## Files touched by this workflow

| Path | Role |
|------|------|
| `docker-compose.yml` | Postgres for Prisma (`POSTGRES_DB=mydb`) |
| `supabase/config.toml` | Local Supabase ports, Storage buckets |
| `supabase/seed.sql` | Optional seed hook for `supabase db reset` |
| `scripts/setup-local-dev.mjs` | `npm run dev:docker` |
| `scripts/print-local-dev-env.mjs` | `npm run dev:docker:env` |
| `server/.env.example` | Documented local variables |
