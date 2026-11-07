# Financial calculations

Implementation: `src/lib/engine` (per trade) and `src/lib/analytics` (aggregates). Tests: `*.test.ts` next to the code.
All arithmetic uses decimal.js (40 significant digits, ROUND_HALF_UP); stored at 10 dp; displayed at 2 dp.

## Instrument multiplier (value of a 1.0 price move per 1 unit of quantity, in quote currency)
Priority:
1. `point_value`
2. `tick_value / tick_size`
3. Forex/CFD: `contract_size` (× `contract_multiplier` if set) — quantity is in lots
4. Futures: `contract_multiplier`
5. Stocks/crypto: `contract_multiplier` or **1**

Forex/CFD/futures without the required fields ⇒ **unavailable** (`MISSING_INSTRUMENT_SPEC`). Nothing is assumed.

## Per trade
- **Direction:** from the first execution (buy ⇒ long) or explicit; the first execution must be an entry.
- **Lot matching:** exits close open entry lots FIFO (default) or LIFO (profile setting). An exit larger than the open position is
  rejected (`POSITION_FLIP`); the importer splits flips into two trades with pro-rated fees before calling the engine.
- **Average entry/exit:** quantity-weighted.
- **Realized P&L (quote ccy)** = Σ over matched lots `(exit − entry) × qty × multiplier × (+1 long / −1 short)`.
- **Currency conversion:** each lot's P&L is converted with the FX rate of **its exit date** (UTC). Lookup: exact date direct
  pair, else inverse; optionally the latest *prior* rate within `fx_max_stale_days` (0–7). Never today's rate, never a future rate.
  Missing ⇒ gross/net unavailable (`MISSING_FX_RATE`).
- **Fees** = Σ (fee + commission) across executions, account currency, positive cost. **Swap** (account ccy, negative = cost).
- **Net P&L** = gross (account ccy) − fees + swap.
- **Broker P&L:** if provided and calculated net differs by > 0.01 ⇒ `BROKER_PNL_MISMATCH` warning. If calculated net is unavailable,
  broker net is used and `pnl_source = 'broker'` (gross = broker net + fees − swap).
- **Initial risk** = `|avg entry − stop| × total entry qty × multiplier`, converted at the **first execution date**; the stop must be
  below entry for longs / above for shorts (`INVALID_STOP_LOSS`). A manual initial risk (account ccy) overrides it.
- **R-multiple** = net P&L ÷ initial risk (closed trades only).
- **Planned R:R** = `|target − entry| ÷ |entry − stop|`.
- **Outcome:** |net| ≤ breakeven tolerance ⇒ breakeven; else win/loss. Open trades have no outcome.
- **Holding time:** first execution → last exit.

## Aggregates (`summarize`)
Only closed trades with available net P&L count toward money metrics; others are reported as `unavailableTrades`.
| Metric | Definition |
|---|---|
| Net / gross P&L, fees | Σ over realized trades |
| Win rate | wins ÷ (wins + losses) × 100 (breakevens excluded) |
| Profit factor | Σ net of winners ÷ |Σ net of losers|; `null` if no losers (`profitFactorInfinite` when there are winners) |
| Avg winner / loser | mean net of winners / losers |
| Expectancy | Σ net ÷ number of realized trades |
| Avg R / total R | over trades with an R-multiple |
| Max drawdown | largest peak-to-trough decline of cumulative realized P&L ordered by close time (from starting balance if known; % of peak only then) |
| Streaks | consecutive wins/losses by close time; breakevens neither extend nor break |
| Daily series | grouped by close date in the user's timezone |
| Discipline score | 60% rule compliance (share of reviewed trades with rules followed) + 40% mean discipline rating ÷ 10; whichever exists if only one |
| Prop status | balance = start + realized; daily loss = today's realized loss vs limit; drawdown from start (static) or realized peak (trailing); status ok/warning (≥50%)/danger (≥80%)/breached/passed |

## Currency scoping
Aggregates never mix currencies. With "All accounts" selected, only accounts in the profile base currency are aggregated and the
UI lists the excluded accounts.
