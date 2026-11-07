import { AlertTriangle, CheckCircle2, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { GroupBars } from "@/components/charts/charts";
import { InstrumentDialog } from "@/components/forms/instrument-dialog";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { ScopeNote } from "@/components/shared/scope-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupBy } from "@/lib/analytics";
import { toGroupData } from "@/lib/analytics/chart-data";
import { pnlMultiplier, reviewInstrumentSpec } from "@/lib/engine";
import { listInstruments } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { duration, money, pct, plain, ratio, rMultiple } from "@/lib/utils/format";
import { deleteInstrument } from "@/server/actions/management";
import { instrumentToSpec } from "@/server/services/trade-service";
import { loadAnalytics } from "@/server/services/analytics-service";

// Server actions on this page (import / recalculation) may run longer than the default.
export const maxDuration = 60;
export const metadata = { title: "Instruments" };

export default async function InstrumentsPage() {
  const ctx = await requireUser();
  const [data, instruments] = await Promise.all([loadAnalytics(ctx), listInstruments(ctx.supabase)]);
  const { trades, currency } = data;
  const groups = groupBy(trades, (t) => t.symbol);
  const byClass = groupBy(trades, (t) => t.assetClass);

  return (
    <>
      <PageHeader title="Instruments" description="Performance per instrument and the contract specifications used for every P&L calculation." actions={<InstrumentDialog trigger={<Button variant="primary"><Plus />New instrument</Button>} />} />
      <ScopeNote excluded={data.excluded} currency={currency} unavailable={data.summary.unavailableTrades} />

      {groups.length > 0 && (
        <div className="mb-6 grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle>Net P&amp;L by instrument</CardTitle></CardHeader>
            <CardContent><GroupBars data={toGroupData(groups, 15)} currency={currency} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By asset class</CardTitle></CardHeader>
            <CardContent><GroupBars data={toGroupData(byClass)} currency={currency} /></CardContent>
          </Card>
          <Card className="xl:col-span-3">
            <CardHeader><CardTitle>Instrument statistics</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-right">
                  <th className="py-2 text-left font-medium">Instrument</th><th className="font-medium">Trades</th><th className="font-medium">Win rate</th><th className="font-medium">Net P&amp;L</th><th className="font-medium">Profit factor</th><th className="font-medium">Avg win</th><th className="font-medium">Avg loss</th><th className="font-medium">Avg R</th><th className="font-medium">Avg hold</th>
                </tr></thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key} className="num border-b border-line/50 text-right text-fg-2 last:border-0">
                      <td className="py-2 text-left font-medium text-fg">{g.label}</td>
                      <td>{g.summary.totalTrades}</td><td>{pct(g.summary.winRate)}</td>
                      <td><Pnl value={g.summary.netPnl} currency={currency} /></td>
                      <td>{g.summary.profitFactorInfinite ? "∞" : ratio(g.summary.profitFactor)}</td>
                      <td>{money(g.summary.avgWinner, currency)}</td><td>{money(g.summary.avgLoser, currency)}</td>
                      <td>{rMultiple(g.summary.avgR)}</td><td>{duration(g.summary.avgHoldingSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold">Contract specifications</h2>
      {!instruments.length ? (
        <EmptyState icon={Shapes} title="No instruments yet" description="Instruments are created automatically when you add or import trades. You can also define them up front." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line/70 bg-card">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-left">
              <th className="px-4 py-2.5 font-medium">Symbol</th><th className="font-medium">Class</th><th className="font-medium">Currency</th><th className="font-medium">Contract size</th><th className="font-medium">Tick size / value</th><th className="font-medium">Point value</th><th className="font-medium">Value per 1.0 move</th><th className="font-medium">Status</th><th />
            </tr></thead>
            <tbody>
              {instruments.map((i) => {
                const m = pnlMultiplier(instrumentToSpec(i));
                const issues = reviewInstrumentSpec(instrumentToSpec(i));
                return (
                  <tr key={i.id} className="num border-b border-line/50 text-fg-2 last:border-0" data-testid="instrument-row">
                    <td className="px-4 py-2.5 font-medium text-fg">{i.symbol}</td>
                    <td>{i.asset_class}</td>
                    <td>{i.quote_currency ?? "—"}</td>
                    <td>{plain(i.contract_size)}</td>
                    <td>{i.tick_size ? `${plain(i.tick_size)} / ${plain(i.tick_value)}` : "—"}</td>
                    <td>{plain(i.point_value)}</td>
                    <td className="text-fg">{m.ok ? `${plain(m.multiplier.toFixed())} ${i.quote_currency ?? ""}` : "—"}</td>
                    <td>
                      {issues.length ? <Badge tone="warning" title={issues.map((x) => x.message).join(" ")}><AlertTriangle className="size-3" />incomplete</Badge>
                        : i.reviewed ? <Badge tone="profit"><CheckCircle2 className="size-3" />reviewed</Badge> : <Badge tone="warning">review</Badge>}
                    </td>
                    <td className="pr-3 text-right">
                      <InstrumentDialog instrument={i} trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${i.symbol}`}><Pencil /></Button>} />
                      <ConfirmButton variant="ghost" size="icon" aria-label={`Delete ${i.symbol}`} action={deleteInstrument.bind(null, i.id)} title={`Delete ${i.symbol}?`} description="Only instruments without trades can be deleted." success="Instrument deleted"><Trash2 /></ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
