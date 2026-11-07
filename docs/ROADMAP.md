# Roadmap

## Next (hardening)
- E2E coverage for screenshots, journal screenshots, settings/FX recalculation, account deletion.
- Background recalculation jobs + progress UI; server-side pagination for the trades table.
- SQL-side daily aggregates for very large accounts.
- Error monitoring (Sentry) and audit log of financial edits.

## Product
- Verified broker CSV presets (MT4/MT5, cTrader, NinjaTrader, Tradovate, IBKR…) built from real sample exports.
- Automatic historical FX rates (ECB reference rates) with source labelling.
- Instrument spec library curated from exchange specs (opt-in, always user-reviewable).
- Goals (weekly/monthly targets) and alerts; prop-firm intraday equity rules when live data exists.
- Trade replay / price charts with entries & exits (market data provider).
- Mentor/team sharing with read-only links (RLS-based sharing tables).
- Insights engine ("you lose most on Mondays after 2pm") on top of analytics.
- Billing (Stripe) with plans and limits; onboarding emails.

## Platform
- CI pipeline: lint, typecheck, unit, `test:db`, E2E against `supabase start`.
- Generated Supabase types (`supabase gen types`) replacing hand-written row types.
