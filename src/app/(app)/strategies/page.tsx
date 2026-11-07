import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { EquityCurve, GroupBars } from "@/components/charts/charts";
import { StrategyDialog } from "@/components/forms/strategy-dialog";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { GroupTable } from "@/components/shared/group-table";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dailySeries, equityCurve, groupBy, summarize } from "@/lib/analytics";
import { toEquityData, toGroupData } from "@/lib/analytics/chart-data";
import { requireUser } from "@/lib/db/session";
import { pct, ratio, rMultiple } from "@/lib/utils/format";
import { deleteStrategy } from "@/server/actions/management";
import { loadAnalytics } from "@/server/services/analytics-service";

export const metadata = { title: "Strategies" };

export default async function StrategiesPage() {
  const ctx = await requireUser();
  const data = await loadAnalytics(ctx);
  const { trades, strategies, currency, tz } = data;
  const groups = groupBy(trades, (t) => t.strategyName ?? "No strategy");
  const newBtn = <StrategyDialog trigger={<Button variant="primary"><Plus />New strategy</Button>} />;

  return (
    <>
      <PageHeader title="Strategies" description="Which setups actually make money? Compare every strategy on the same metrics." actions={newBtn} />
      <ScopeNote excluded={data.excluded} currency={currency} unavailable={data.summary.unavailableTrades} />
      {!strategies.length ? (
        <EmptyState icon={Target} title="No strategies defined" description="Create strategies (your playbook setups), then assign them to trades to compare their performance." action={newBtn} />
      ) : (
        <>
          {groups.length > 0 && (
            <div className="mb-4 grid gap-4 xl:grid-cols-3">
              <Card><CardHeader><CardTitle>Net P&amp;L by strategy</CardTitle></CardHeader><CardContent><GroupBars data={toGroupData(groups)} currency={currency} /></CardContent></Card>
              <Card className="xl:col-span-2"><CardHeader><CardTitle>Comparison</CardTitle></CardHeader><CardContent><GroupTable rows={groups} currency={currency} label="Strategy" /></CardContent></Card>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {strategies.map((st) => {
              const list = trades.filter((t) => t.strategyId === st.id);
              const s = summarize(list);
              const eq = equityCurve(dailySeries(list, tz));
              return (
                <Card key={st.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: st.color }} /><h3 className="font-semibold">{st.name}</h3>{st.timeframe && <Badge>{st.timeframe}</Badge>}{!st.is_active && <Badge>inactive</Badge>}</div>
                      {st.description && <p className="mt-1 line-clamp-2 text-sm text-fg-2">{st.description}</p>}
                    </div>
                    <div className="flex">
                      <StrategyDialog strategy={st} trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${st.name}`}><Pencil /></Button>} />
                      <ConfirmButton variant="ghost" size="icon" aria-label={`Delete ${st.name}`} action={deleteStrategy.bind(null, st.id)} title={`Delete ${st.name}?`} description="Trades keep their data but lose this strategy assignment." success="Strategy deleted"><Trash2 /></ConfirmButton>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-3 text-sm">
                    {[["Net", <Pnl key="n" value={s.netPnl} currency={currency} />], ["Trades", s.totalTrades], ["Win", pct(s.winRate)], ["PF", s.profitFactorInfinite ? "∞" : ratio(s.profitFactor)], ["Avg R", rMultiple(s.avgR)]].map(([k, v]) => (
                      <div key={String(k)}><p className="text-[11px] uppercase tracking-wider text-muted">{k}</p><p className="num mt-0.5 font-semibold">{v}</p></div>
                    ))}
                  </div>
                  {eq.length > 1 ? <div className="mt-3"><EquityCurve data={toEquityData(eq)} currency={currency} /></div> : <p className="mt-4 text-sm text-muted">{list.length ? "Not enough trading days for a curve." : <>No trades in this period. <Link href="/trades" className="text-gold">Assign trades</Link></>}</p>}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
