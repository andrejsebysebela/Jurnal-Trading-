import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { tradeToValues } from "@/components/trades/form-values";
import { TradeForm } from "@/components/trades/trade-form";
import { getTrade, listAccounts, listInstruments, listStrategies, listTags } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";

export const metadata = { title: "Edit trade" };

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, profile } = await requireUser();
  const [trade, accounts, instruments, strategies, tags] = await Promise.all([getTrade(supabase, id), listAccounts(supabase), listInstruments(supabase), listStrategies(supabase), listTags(supabase)]);
  if (!trade) notFound();
  return (
    <>
      <PageHeader title={`Edit ${trade.symbol} trade`} description="Changing executions or risk recalculates every metric on save." />
      <TradeForm
        initial={tradeToValues(trade, profile.timezone)}
        accounts={accounts}
        instruments={instruments}
        strategies={strategies}
        timeZone={profile.timezone}
        knownTags={tags.filter((t) => t.kind === "tag").map((t) => t.name)}
        knownMistakes={tags.filter((t) => t.kind === "mistake").map((t) => t.name)}
      />
    </>
  );
}
