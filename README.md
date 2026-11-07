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
| `pnpm test:e2e` | Playwright end-to-end journey (needs app + local Supabase) |
| `pnpm typecheck` / `pnpm lint` | Static checks |
| `pnpm db:reset` | Re-apply migrations to local Supabase |

## Deploying
1. Create a Supabase project; run the migrations in `supabase/migrations` (`supabase db push`).
2. Configure Auth (site URL, redirect `https://<domain>/auth/callback`, enable email confirmations).
3. Deploy the Next.js app (e.g. Vercel) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Documentation
- `CLAUDE.md` — permanent engineering rules
- `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`, `docs/ROADMAP.md`, `docs/COMPETITIVE_ANALYSIS.md`
