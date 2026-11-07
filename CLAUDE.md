# EDGELOG — permanent project rules

EDGELOG is a professional trading journal & performance analytics SaaS (Next.js App Router + Supabase).
Read `docs/ARCHITECTURE.md` and `docs/CALCULATIONS.md` before changing anything financial.

## Non-negotiable financial rules
1. **Never use JS `number` arithmetic for money, prices or quantities.** Use `D` / `dec()` from `src/lib/engine/decimal.ts`
   (decimal.js, 40 significant digits). Values cross module boundaries as decimal **strings**.
   Converting to `number` is allowed ONLY for chart rendering (`toChartNumber`, `src/lib/analytics/chart-data.ts`).
2. **Never invent instrument specs** (contract size, tick value, point value, currency). Missing spec ⇒ P&L is `null`
   ("unavailable") plus a `CalcIssue`. Stocks/crypto default to 1 unit; forex/CFD/futures never default.
3. **Never substitute today's FX rate for a missing historical rate.** `createFxLookup` only uses the exact date
   (or a prior date within the user's `fx_max_stale_days`, 0–7). Never a future rate.
4. **Never sum money across currencies.** Aggregations are scoped to one currency (`loadAnalytics` / `loadPeriod`).
5. One calculation engine: `src/lib/engine`. Do not create a second implementation. Server computes and stores
   results (`trade-service.ts`); the client may run the same engine for previews only.
6. Executions are the source of truth. Computed trade columns must be rebuildable via `recalculateTrades`.
   Any change to instrument specs, FX rates, account currency or calc settings must trigger recalculation.
7. Timestamps are stored in UTC (`timestamptz`); display/day-bucketing uses the profile timezone.
8. Numeric DB columns are selected as `::text` (see `src/lib/db/columns.ts`) — never let PostgREST hand back floats.

## Architecture boundaries
- `src/lib/engine` — pure financial math (no I/O). `src/lib/analytics` — pure aggregation. `src/lib/import` — pure CSV parsing/normalisation.
- `src/lib/db` — queries, row types, filters (server-only where marked). `src/lib/validation` — Zod schemas (shared client/server).
- `src/server/services` — business logic with I/O. `src/server/actions` — thin "use server" wrappers: validate → service → revalidate.
- `src/components` — UI only; no business logic. Constants shared with server components live in `src/lib/constants.ts`
  (never import non-component exports from a `"use client"` module into a server component).
- Security: every table has RLS `user_id = auth.uid()` + composite `(id, user_id)` FKs. Never use the service-role key in app code.

## Coding standards
- TypeScript strict; no `any` in new code. Zod-validate every server action input. Return `ActionResult` (never throw to the client).
- Keep components small; pages are server components that load data and compose client components.
- UI: use design tokens (`bg-card`, `text-fg-2`, `text-profit`, `text-gold`…) from `src/app/globals.css`; gold sparingly.
  Profit/loss colour must always be paired with a sign or position (red/green fails CVD checks).
- Forms: wrap controls with `<Field>` so labels are programmatically associated.

## Testing requirements (run before every commit)
- `pnpm test` — Vitest unit tests (engine, analytics, import). New financial logic needs hand-verified test cases.
- `pnpm test:db` — migrations + RLS isolation tests on plain PostgreSQL (needs a local `psql`; see supabase/tests/run.sh).
- `pnpm test:e2e` — Playwright journey against the app + local Supabase (`pnpm db:start`, `pnpm dev`).
- `pnpm typecheck && pnpm lint && pnpm build` must pass.

## Database changes
- Add a NEW migration in `supabase/migrations` (never edit an applied one once deployed). Enable RLS + 4 policies on every new table,
  add composite FKs for child tables, update `docs/DATABASE.md` and `supabase/tests/rls.test.sql`.
