import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { tradeToValues } from "@/components/trades/form-values";
import { TradeForm } from "@/components/trades/trade-form";
import { getTrade, listAccounts } from "@/lib/db/queries";
import { listTradedSymbols } from "@/lib/db/symbols";
import { requireUser } from "@/lib/db/session";
import { fill } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, profile, user } = await requireUser();
  const { t } = await getI18n();
  const [trade, accounts, symbols] = await Promise.all([getTrade(supabase, id), listAccounts(supabase), listTradedSymbols(supabase)]);
  if (!trade) notFound();
  return (
    <>
      <PageHeader title={fill(t.trade.editTitle, { pair: trade.symbol })} />
      <TradeForm initial={tradeToValues(trade, profile.timezone)} accounts={accounts} symbols={symbols} timeZone={profile.timezone} userId={user.id} screenshots={trade.screenshots} />
    </>
  );
}
