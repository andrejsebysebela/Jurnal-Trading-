import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { emptyTradeValues } from "@/components/trades/form-values";
import { TradeForm } from "@/components/trades/trade-form";
import { getGlobalFilters, listAccounts } from "@/lib/db/queries";
import { listTradedSymbols } from "@/lib/db/symbols";
import { requireUser } from "@/lib/db/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.trade.newTitle };
}

export default async function NewTradePage() {
  const { supabase, profile, user } = await requireUser();
  const { t } = await getI18n();
  const [accounts, filters, symbols] = await Promise.all([listAccounts(supabase), getGlobalFilters(), listTradedSymbols(supabase)]);
  if (!accounts.length) {
    return (
      <>
        <PageHeader title={t.trade.newTitle} />
        <EmptyState icon={Wallet} title={t.trade.noAccountTitle} description={t.trade.noAccountBody} action={<Button asChild variant="primary"><Link href="/accounts">{t.trade.goToAccounts}</Link></Button>} />
      </>
    );
  }
  const active = accounts.filter((a) => a.is_active);
  const defaultAccount = filters.accountId !== "all" ? filters.accountId : active.length === 1 ? active[0].id : "";
  return (
    <>
      <PageHeader title={t.trade.newTitle} description={t.trade.newSubtitle} />
      <TradeForm initial={emptyTradeValues(profile.timezone, defaultAccount)} accounts={active} symbols={symbols} timeZone={profile.timezone} userId={user.id} />
    </>
  );
}
