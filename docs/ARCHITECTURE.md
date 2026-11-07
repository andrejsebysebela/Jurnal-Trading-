# Architecture

```
Browser ── Next.js App Router (RSC + client components)
             │  server components: load data with the user's Supabase session (RLS applies)
             │  server actions:    validate (Zod) → service → revalidatePath
             ▼
        src/server/services  ── uses ──▶ src/lib/engine (pure decimal math)
             │                           src/lib/analytics (pure aggregation)
             │                           src/lib/import (pure CSV → engine input)
             ▼
        Supabase: Postgres (RLS on every table) · Auth (cookies via @supabase/ssr) · Storage (private bucket)
```

## Layers
| Path | Responsibility | I/O |
|---|---|---|
| `src/lib/engine` | Instrument multipliers, FIFO/LIFO lot matching, P&L, fees, risk, R, FX conversion, execution grouping | none |
| `src/lib/analytics` | Summaries, drawdown, streaks, series (daily/equity/monthly), group-bys, mistakes, discipline, prop rules | none |
| `src/lib/import` | CSV parsing, timezone-aware timestamp parsing, number parsing, mapping auto-detect, normalisation, fingerprints | none |
| `src/lib/validation` | Zod schemas shared by forms and server actions | none |
| `src/lib/db` | Row types, select lists (numeric→text), global filters, query helpers, `requireUser` | Supabase |
| `src/server/services` | `trade-service` (save/recalculate), `import-service`, `analytics-service`, `period-service` | Supabase |
| `src/server/actions` | Server actions (auth, trades, management, import, filters) | Supabase |
| `src/components` | UI: `ui/` primitives, `layout/`, `charts/`, `trades/`, `journal/`, `forms/`, `import/`, `shared/` | — |
| `src/app` | Routes: `(auth)` public pages, `(app)` authenticated pages, `api/export`, `auth/callback` | — |

## Request flow: saving a trade
1. Client form → `saveTradeAction(payload)` (decimal strings, local datetimes).
2. Zod validation (`tradeFormSchema`) → `saveTrade(ctx, data)`.
3. Service loads account, instrument (creates an **unreviewed** one if new — no specs invented), profile settings, FX rates for the pair.
4. `computeTrade()` → computed columns → `rpc('save_trade')` (single transaction: trade + executions + tags, SECURITY INVOKER so RLS applies).
5. `revalidatePath('/', 'layout')`.

## Global filters
Date range + account live in the `edgelog_filters` cookie (`src/lib/db/filters.ts`), resolved to UTC instants in the user's timezone.
Every analytics page uses `loadAnalytics()` which also enforces single-currency aggregation.

## Auth & security
- `@supabase/ssr` cookie sessions; `src/middleware.ts` refreshes sessions, redirects unauthenticated page requests to `/login`
  and answers `401` for `/api/*`.
- RLS on all tables (`user_id = auth.uid()`), `FORCE ROW LEVEL SECURITY`, composite `(id, user_id)` FKs between user tables.
- Storage: private `screenshots` bucket; object paths start with the user id and policies check the first folder.
- Server actions validate every input; screenshot registration re-checks that the path is inside the user's folder.
- Security headers in `next.config.ts` (frame-deny, nosniff, referrer, permissions policy).

## Scaling notes
Analytics load all trades in the filtered range (paged 1000 rows at a time) and aggregate in Node with decimal.js. This is fine for
tens of thousands of trades per user. Next steps when needed: SQL materialised daily aggregates per account, server-side pagination
for the trades table, and a background job for recalculation (currently synchronous).
