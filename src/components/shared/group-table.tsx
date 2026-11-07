import type { GroupRow } from "@/lib/analytics";
import { duration, money, pct, ratio, rMultiple } from "@/lib/utils/format";
import { Pnl } from "./pnl";

export function GroupTable({ rows, currency, label = "Group", empty = "No data for this period." }: { rows: GroupRow[]; currency: string; label?: string; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="text-[11px] uppercase tracking-wider text-muted">
          <tr className="border-b border-line text-right">
            <th className="py-2 text-left font-medium">{label}</th><th className="font-medium">Trades</th><th className="font-medium">Win rate</th><th className="font-medium">Net P&amp;L</th>
            <th className="font-medium">Expectancy</th><th className="font-medium">Profit factor</th><th className="font-medium">Avg R</th><th className="font-medium">Avg hold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key} className="num border-b border-line/50 text-right text-fg-2 last:border-0">
              <td className="py-2 text-left font-medium text-fg">{g.label}</td>
              <td>{g.summary.totalTrades}</td>
              <td>{pct(g.summary.winRate)}</td>
              <td className="font-semibold"><Pnl value={g.summary.netPnl} currency={currency} /></td>
              <td>{money(g.summary.expectancy, currency, { sign: true })}</td>
              <td>{g.summary.profitFactorInfinite ? "∞" : ratio(g.summary.profitFactor)}</td>
              <td>{rMultiple(g.summary.avgR)}</td>
              <td>{duration(g.summary.avgHoldingSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
