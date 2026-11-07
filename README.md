# EDGELOG

Professional trading journal & performance analytics. Track trades from executions, get decimal-exact P&L, R-multiples,
drawdown and strategy/instrument/time analytics, journal every day, and monitor prop-firm limits.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Radix primitives (shadcn-style) · Recharts · TanStack Table ·
React Hook Form · Zod · Supabase (Postgres, Auth, Storage, RLS) · decimal.js · Vitest · Playwright · pnpm.

## Quick start (local)
Requirements: Node 20+, pnpm 10, Docker.

```bash
pnpm install
```

```bash
pnpm db:start
```

`db:start` prints the API URL and anon/publishable key. Copy them into `.env.local` (see `.env.example`):

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

Open http://127.0.0.1:3000, create an account (email confirmation is disabled locally), then create a trading account.

> If `public.ecr.aws` is blocked on your network, start Supabase with Docker Hub images:
> `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start`

## Scripts
| Script | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run / build the app |
| `pnpm test` | Unit tests (calculation engine, analytics, CSV import) |
| `pnpm test:db` | Apply migrations to a scratch PostgreSQL DB and run RLS/integrity tests |
| `pnpm test:e2e` | Playwright end-to-end tests (needs app + local Supabase; set `E2E_SUPABASE_SERVICE_KEY` to the LOCAL secret key to include the password-reset test) |
| `pnpm test:integration` | Tenant-isolation tests against a real (local) Supabase REST/Storage API (`SUPABASE_TEST_ANON_KEY`) |
| `pnpm typecheck` / `pnpm lint` | Static checks |
| `pnpm db:reset` | Re-apply migrations to local Supabase |

## Deploying
See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** (GitHub → Vercel, Supabase Cloud, custom domain, DNS, HTTPS, troubleshooting)
and **[docs/SECURITY.md](docs/SECURITY.md)**.

## Documentation
- `CLAUDE.md` — permanent engineering rules
- `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`
- `docs/DEPLOYMENT.md`, `docs/SECURITY.md`
- `docs/IMPLEMENTATION_STATUS.md`, `docs/ROADMAP.md`, `docs/COMPETITIVE_ANALYSIS.md`
