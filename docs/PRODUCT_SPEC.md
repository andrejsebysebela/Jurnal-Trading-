# EDGELOG — Product specification

> **Current scope (2026-11-08):** simplified journal + Slovak/English — see the *Product scope* section in `CLAUDE.md`
> and `docs/IMPLEMENTATION_STATUS.md`. The module list below describes the original v1 and is partly superseded.

**Category:** professional trading journal & performance analytics SaaS.
**Vision:** turn a trader's history into actionable performance data so they become more consistent.

## Questions the product answers
| Question | Where |
|---|---|
| Am I actually profitable? | Dashboard KPIs (net P&L, expectancy, profit factor), Performance |
| Which strategy makes the most money? | Strategies, Dashboard "By strategy" |
| Which instrument do I trade best? | Instruments, Dashboard "By instrument" |
| At what time / on which days do I perform best? | Reports → Days & times (weekday, hour, holding time) |
| Am I risking too much? | R-multiple, initial risk, Reports → Risk, max drawdown |
| Do I follow my plan? | Rule compliance on trades, Playbook rules, Progress Tracker daily checks |
| Which mistakes cost the most? | Reports → Tags & mistakes, Dashboard "Most common mistake" |
| Am I improving? | Progress Tracker (weekly trends, month vs month), Performance |
| Which prop accounts are close to limits? | Accounts (prop rules), top-bar notifications |

## Users
Forex, CFD, futures, stock and crypto traders; prop-firm traders; intraday and swing traders.

## Modules (all implemented — see IMPLEMENTATION_STATUS.md)
- **Global layout:** collapsible sidebar (4 sections), top bar with global date range + account selector (persisted in a cookie),
  search, notifications, user menu, mobile drawer.
- **Dashboard:** 10 KPIs, equity curve (P&L or balance), daily P&L, monthly performance with year selector, win/loss distribution,
  by strategy / instrument / long-short, 10 insight widgets, onboarding empty state.
- **Calendar:** monthly grid with P&L, trade count, W/L, journal indicator, discipline score, weekly totals; Day view with stats,
  trades, journal (plan, review, emotions, rule violations, mood, discipline) and screenshots; prev/next day and month navigation.
- **Trades:** TanStack table with search, sorting, pagination, advanced filters, column visibility & resizing, bulk tag/mistake/
  strategy/session edits, delete with confirmation, duplicate (as draft), CSV export of the filtered view.
- **Trade detail:** overview, executions, setup + strategy checklist, screenshots (before/after/additional, preview, delete),
  autosaving notes, psychology (emotion, confidence, discipline, rule compliance, mistakes), calculation issues with fix links.
- **Add/Edit trade:** multi-execution entry with partial exits, live engine preview, drafts, validation.
- **Reports / Performance / Instruments / Strategies**, **Daily Journal**, **Trade Notes**, **Playbook** (+ trading rules),
  **Progress Tracker**, **Accounts** (prop rules), **Import** (CSV wizard, dedupe, undo), **Settings** (profile, calc preferences,
  FX rates, tags, recalc, JSON export).

## Key product decisions
- **Accuracy over completeness:** missing specs or FX rates show "unavailable" — never guessed values.
- **Broker P&L reconciliation:** trade-row imports keep the broker's P&L; a mismatch > 0.01 is flagged; it is used as an explicit,
  labelled fallback only when the calculated value is unavailable.
- **Currency-safe aggregation:** "All accounts" aggregates only accounts in the base currency and lists excluded ones.
- **Win rate** = wins ÷ (wins + losses); breakevens excluded (tolerance configurable).
- Bulk edits never touch financial fields.

## Out of scope for v1 (see ROADMAP.md)
Broker API sync, trade replay/market data, automatic FX rate feeds, billing, teams/mentor sharing, AI insights, mobile apps.
