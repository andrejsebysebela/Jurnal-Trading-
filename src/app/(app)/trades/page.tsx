import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TradesTable, type TradeListRow } from "@/components/trades/trades-table";
import { listAccounts, listFilteredTrades } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { fill } from "@/lib/i18n/config";
import { rangeLabel } from "@/lib/i18n/range";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.trades.title };
}

export default async function TradesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const [accounts, { trades, filters }] = await Promise.all([listAccounts(ctx.supabase), listFilteredTrades(ctx)]);
  const ids = trades.map((x) => x.id);
  const withShots = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await ctx.supabase.from("screenshots").select("trade_id").in("trade_id", ids.slice(i, i + 200));
    data?.forEach((s) => s.trade_id && withShots.add(s.trade_id));
  }
  // Only what the table needs crosses to the client.
  const rows: TradeListRow[] = trades.map((x) => ({
    id: x.id, account_id: x.account_id, symbol: x.symbol, direction: x.direction, opened_at: x.opened_at, closed_at: x.closed_at,
    activity_at: x.activity_at, net_pnl: x.net_pnl, risk: x.manual_initial_risk ?? x.initial_risk, r_multiple: x.r_multiple,
    planned_rr: x.planned_rr, holding_seconds: x.holding_seconds, outcome: x.outcome, emotion: x.emotional_state, notes: x.notes ?? x.psychology_notes,
    has_screenshots: withShots.has(x.id), tradingview_url: x.tradingview_url,
  }));
  const add = <Button asChild variant="primary"><Link href="/trades/new"><Plus />{t.topbar.addTrade}</Link></Button>;
  return (
    <>
      <PageHeader title={t.trades.title} description={fill(t.trades.subtitle, { range: rangeLabel(filters, t), tz: ctx.profile.timezone })} actions={add} />
      {rows.length === 0 && !sp.q ? (
        <EmptyState icon={Layers} title={t.trades.emptyTitle} description={t.trades.emptyBody} action={add} />
      ) : (
        <TradesTable rows={rows} accounts={accounts} timeZone={ctx.profile.timezone} initialQuery={sp.q} />
      )}
    </>
  );
}
