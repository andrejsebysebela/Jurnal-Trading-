import Link from "next/link";
import { Layers, Plus, Upload } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TradesTable } from "@/components/trades/trades-table";
import { listAccounts, listFilteredTrades, listStrategies } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";

export const metadata = { title: "Trades" };

export default async function TradesPage({ searchParams }: { searchParams: Promise<{ q?: string; pnl?: string }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const [accounts, strategies, { trades, range }] = await Promise.all([listAccounts(ctx.supabase), listStrategies(ctx.supabase), listFilteredTrades(ctx, { includeDrafts: true })]);
  return (
    <>
      <PageHeader
        title="Trades"
        description={`${range.label} · times in ${ctx.profile.timezone}`}
        actions={<><Button asChild variant="secondary"><Link href="/import"><Upload />Import</Link></Button><Button asChild variant="primary"><Link href="/trades/new"><Plus />Add trade</Link></Button></>}
      />
      {trades.length === 0 && !sp.q ? (
        <EmptyState icon={Layers} title="No trades in this period" description="Add a trade manually or import your broker history. Adjust the date range in the top bar to see older trades." action={<Button asChild variant="primary"><Link href="/trades/new"><Plus />Add trade</Link></Button>} />
      ) : (
        <TradesTable rows={trades} accounts={accounts} strategies={strategies} timeZone={ctx.profile.timezone} initialQuery={sp.q} initialPnl={sp.pnl} />
      )}
    </>
  );
}
