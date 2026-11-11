# Implementation status — 2026-11-07

## Starting point
The repository was **empty** (no prior code, no calculation engine, no git history), so there was nothing to audit or preserve.
Everything below was built in this pass. The original specification text was truncated mid-§11 (FX sentence); sections after that
were inferred from the modules the spec lists (import, accounts/prop firms, journal, playbook, progress, settings).

## Done and verified
| Area | Status | Verification |
|---|---|---|
| Calculation engine (decimal, FIFO/LIFO, partials, multi-asset specs, FX, risk/R, broker reconciliation, flip splitting) | ✅ | 20 unit tests, hand-computed values |
| Analytics (summary, drawdown, streaks, series, groupings, mistakes, discipline, prop rules) | ✅ | 14 unit tests |
| CSV import (mapping auto-detect, timezones, number formats, executions & trade rows, dedupe fingerprints, merge of re-exported partial positions, undo) | ✅ | 8 unit tests + E2E (import, re-import ⇒ duplicates skipped) |
| Database schema, RLS, composite FKs, storage policies, `save_trade` RPC | ✅ | `pnpm test:db` RLS suite on PostgreSQL 16; migrations applied on local Supabase (Postgres 17) |
| Auth (sign up/in/out, middleware, 401 for APIs) | ✅ | E2E |
| All 15 sidebar pages + trade new/edit/detail + day view | ✅ | E2E visits every page with no runtime errors |
| Dashboard KPIs/charts/widgets respond to date & account filters | ✅ | E2E asserts KPI values against hand calculation |
| Trade table: search, sort, filters, column visibility/resize, bulk edit, delete, duplicate, CSV export | ✅ | E2E (bulk edit) + manual |
| Screenshots upload/preview/delete (private bucket, signed URLs) | ✅ | E2E upload/view/delete + integration isolation test |
| Responsive layout (mobile drawer, no horizontal overflow) | ✅ | iPhone 13 viewport check |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ | clean |

## Known limitations
- Competitor research could not be performed: competitor websites were unreachable from the build environment (network policy).
  `COMPETITIVE_ANALYSIS.md` is therefore marked unverified.
- FX rates are entered manually (no rate feed yet).
- Recalculation runs synchronously inside the request (fine for thousands of trades; move to a job queue later).
- Trades table filters client-side on the loaded date range (server-side pagination is on the roadmap).
- No broker-specific CSV presets are shipped (we don't publish formats we can't verify); users map columns once and save the mapping.
- Open positions use realized P&L only (no live prices).
- Email confirmation is disabled in local `supabase/config.toml`; enable it in production.

## Production-readiness pass (2026-11-07)
- Auth: email confirmation redirect via `NEXT_PUBLIC_SITE_URL`, password reset (forgot/reset pages), token-hash `/auth/confirm`,
  open-redirect guard, Secure cookies on HTTPS, signup timezone capture, React-19 form reset fix on the login form.
- Security: CSP/HSTS/COOP headers, sanitised error messages, error/404 pages, per-user rate limits (migration 3), postcss override (0 audit findings).
- Vercel compatibility: 4 MB CSV cap (4.5 MB body limit), `maxDuration` on heavy pages, pinned `packageManager`/`engines`, no localhost in production.
- Verification added: integration isolation tests (real REST/Storage), password-reset E2E, screenshot upload E2E, `verify_production.sql`, CI workflow, Dependabot.
- See docs/DEPLOYMENT.md and docs/SECURITY.md (remaining risks).

## Simplified journal + Slovak/English (2026-11-08)
Requested by the owner after first production use:
- Simple trade entry (pair, direction, risk, result, planned RR, open/close time, account, screenshots, TradingView link, emotion,
  psychology, notes); live R preview; edit/duplicate/delete; statistics by pair, weekday, hour, direction, emotion, account.
- Accounts: prop firm (challenge / verification / funded) or personal (live / demo); per-account statistics and prop rule progress.
- Navigation reduced to Dashboard, Trades, Calendar, Statistics, Accounts, Settings. Removed UI modules (instruments, strategies,
  daily journal, notes, playbook, progress tracker, CSV import, reports, performance) — code is in git history; tables are kept.
- Full Slovak + English UI with locale-aware money/number/date formatting and Slovak plurals; language switch in the top bar,
  auth pages and Settings (cookie, defaults to the browser language).
- Fixed: native dropdown options were white-on-white on Windows; screenshots picked in the new-trade form were dropped.
- Verified: 56 unit tests, RLS suite, 5 API isolation tests, 80/80 production checks, 6 E2E tests on the production build (EN + SK), mobile width.

## Public 3D landing page (2026-11-11, branch `landing-3d`)
- `/` is a public, bilingual, scroll-driven 3D page (three.js + @react-three/fiber, lazy-loaded only on this route):
  golden equity ribbon, candle field, calendar heatmap, prop-firm progress rings, final overview shot.
- Signed-in users are redirected to `/dashboard`; anonymous users see the landing page (previously redirected to `/login`).
- Accessibility & performance: canvas is decorative (`aria-hidden`), copy is real HTML; `prefers-reduced-motion` disables
  camera smoothing and reveal animations; no-WebGL devices get a gradient fallback; DPR capped at 1.75.
- All figures on the page are illustrative and labelled as such; no user data is used.
- The requested reference video could not be viewed from the build environment (YouTube bot protection);
  the design follows the "cinematic 3D website" genre named in its title.
