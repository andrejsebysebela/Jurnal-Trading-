# EDGELOG — permanent project rules

EDGELOG is a trading journal & performance statistics SaaS (Next.js App Router + Supabase), bilingual (Slovak + English).
Read `docs/ARCHITECTURE.md` and `docs/CALCULATIONS.md` before changing anything financial.

## Product scope (decided by the owner, 2026-11-08)
Trades are entered in the **simple journal** (`entry_mode = 'simple'`): pair, direction, risk amount, result, planned RR,
open/close time, account, screenshots / TradingView link, emotion + psychology notes, notes. Statistics derive from these.
Accounts are prop firm (challenge / verification / funded) or personal (live / demo), each with its own statistics.
The public landing page lives in `src/components/landing/` (3D scene in `scene.tsx`, illustrative data only).
Do not reintroduce the removed detailed modules (executions UI, instruments, strategies, journal, playbook, import) unless asked.

## Internationalisation
- Every user-facing string lives in `src/lib/i18n/dictionaries/{en,sk}.ts` (`sk` is typed as `Dictionary`, so missing keys fail typecheck).
- Server: `const { t, f } = await getI18n()`; client: `const { t, f } = useI18n()`. Validation schemas take `t` for messages.
- Format numbers/money/dates ONLY with the formatter `f` (`f.money`, `f.pct`, `f.r`, `f.rr`, `f.date`, `f.duration`) — never hand-written.
- Plurals with `plural(locale, n, forms)` (Slovak has one/few/other); placeholders with `fill()`.

## Non-negotiable financial rules
1. **Never use JS `number` arithmetic for money, prices or quantities.** Use `D` / `dec()` from `src/lib/engine/decimal.ts`
   (decimal.js, 40 significant digits). Values cross module boundaries as decimal **strings**.
   Converting to `number` is allowed ONLY for chart rendering (`toChartNumber`, `src/lib/analytics/chart-data.ts`).
2. **Never invent instrument specs** (contract size, tick value, point value, currency). Missing spec ⇒ P&L is `null`
   ("unavailable") plus a `CalcIssue`. Stocks/crypto default to 1 unit; forex/CFD/futures never default.
3. **Never substitute today's FX rate for a missing historical rate.** `createFxLookup` only uses the exact date
   (or a prior date within the user's `fx_max_stale_days`, 0–7). Never a future rate.
4. **Never sum money across currencies.** Aggregations are scoped to one currency (`loadAnalytics` / `loadPeriod`).
5. One calculation engine: `src/lib/engine`. Simple trades use `computeSimpleTrade` (R = result ÷ risk, outcome, duration);
   the server computes and stores (`saveSimpleTrade`); the client runs the same function for the live preview only.
6. Simple trades: the result is entered by the trader in the account currency (`pnl_source = 'manual'`) — that is the source
   of truth. Legacy execution-based trades (`entry_mode = 'executions'`) keep their stored values; the execution engine remains for them.
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
- Native `<select>` option colours are set globally in `globals.css` (Windows ignores the dark theme otherwise).

## Testing requirements (run before every commit)
- `pnpm test` — Vitest unit tests (engine, simple trades, analytics, i18n formatting). New financial logic needs hand-verified test cases.
- `pnpm test:db` — migrations + RLS isolation tests on plain PostgreSQL (needs a local `psql`; see supabase/tests/run.sh).
- `pnpm test:e2e` — Playwright journey (English + Slovak) against the app + local Supabase (`pnpm db:start`, `pnpm dev`).
- `pnpm test:integration` — tenant isolation through the real Supabase REST/Storage API (local stack only).
- `pnpm typecheck && pnpm lint && pnpm build` must pass; CI (`.github/workflows/ci.yml`) runs them plus `test:db` and `pnpm audit`.

## Production rules
- Never read the service-role key in app code; never commit `.env*` (only `.env.example`).
- Auth/email links must use `siteUrl()` (`src/lib/env.ts`); redirects must go through `safeRedirectPath()`.
- User-facing errors go through `fail()` (sanitises DB internals). Expensive actions call `rateLimit()`.
- Never run `supabase db reset` or destructive SQL against a linked/production project; migrations are additive and reviewed with `db push --dry-run`.

## Database changes
- Add a NEW migration in `supabase/migrations` (never edit an applied one once deployed). Enable RLS + 4 policies on every new table,
  add composite FKs for child tables, update `docs/DATABASE.md` and `supabase/tests/rls.test.sql`.
