# Competitive analysis — UNVERIFIED (research blocked)

**Status:** the official websites of TradeZella, TradesViz, TraderSync and Edgewonk could not be fetched from the build environment
(DNS blocked by the network policy on 2026-11-07). Per the specification ("do not invent competitor functionality"), this document
makes **no claims about specific competitors' features**. Redo this research by reading:
https://www.tradezella.com/ · https://help.tradezella.com/ · https://www.tradesviz.com/ · https://tradersync.com/ · https://edgewonk.com/

## General product concepts adopted (from the EDGELOG specification itself)
- Journal + analytics in one place: calendar P&L, trade detail with notes/screenshots, strategy/playbook tracking, psychology fields.
- CSV import with column mapping; per-account tracking including prop-firm rules.

## Pain points EDGELOG designs against (product hypotheses, to validate with users)
1. **Silent P&L errors** from wrong contract specs or FX assumptions → EDGELOG shows "unavailable" and asks for specs/rates.
2. **Mixed-currency totals** across accounts → single-currency aggregation with explicit exclusions.
3. **Duplicate imports** → deterministic fingerprints, merge of re-exported partial positions, one-click undo.
4. **Float rounding drift** → decimal arithmetic end-to-end, numerics transported as strings.
5. **Process vs outcome**: traders need rule adherence tracking, not just P&L → Progress Tracker + rule checks + discipline score.

## Differentiation opportunities
- Broker reconciliation (calculated vs broker P&L) surfaced per trade.
- Transparent formulas (docs/CALCULATIONS.md) and visible calculation issues with fix links.
- Prop-firm limit monitoring in notifications.
- Full data export (JSON) — no lock-in.

## To do once research is possible
- Fill "features worth adopting / implement differently" per competitor with source URLs.
- Compare import coverage, pricing tiers and onboarding flows.
