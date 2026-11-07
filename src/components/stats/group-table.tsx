"use client";
import type { GroupRow } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n/client";
import { Pnl } from "@/components/shared/pnl";

export function GroupTable({ rows, currency, label }: { rows: GroupRow[]; currency: string; label: string }) {
  const { t, f } = useI18n();
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{t.stats.noData}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead className="text-[11px] uppercase tracking-wider text-muted">
          <tr className="border-b border-line text-right">
            <th className="py-2 text-left font-medium">{label}</th><th className="font-medium">{t.stats.trades}</th><th className="font-medium">{t.stats.winRate}</th>
            <th className="font-medium">{t.stats.netPnl}</th><th className="font-medium">{t.stats.avgR}</th><th className="font-medium">{t.stats.profitFactor}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key} className="num border-b border-line/50 text-right text-fg-2 last:border-0">
              <td className="py-2 text-left font-medium text-fg">{g.label}</td>
              <td>{g.summary.totalTrades}</td>
              <td>{f.pct(g.summary.winRate)}</td>
              <td className="font-semibold"><Pnl value={g.summary.netPnl} currency={currency} /></td>
              <td>{f.r(g.summary.avgR)}</td>
              <td>{g.summary.profitFactorInfinite ? "∞" : f.num(g.summary.profitFactor, 2, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
