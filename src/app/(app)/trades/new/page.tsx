import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { emptyTradeValues } from "@/components/trades/form-values";
import { TradeForm } from "@/components/trades/trade-form";
import { getGlobalFilters, listAccounts, listInstruments, listStrategies, listTags } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";

export const metadata = { title: "Add trade" };

export default async function NewTradePage() {
  const { supabase, profile } = await requireUser();
  const [accounts, instruments, strategies, tags, filters] = await Promise.all([listAccounts(supabase), listInstruments(supabase), listStrategies(supabase), listTags(supabase), getGlobalFilters()]);
  if (!accounts.length) {
    return (
      <>
        <PageHeader title="Add trade" />
        <EmptyState icon={Wallet} title="Create an account first" description="Every trade belongs to an account with a currency." action={<Button asChild variant="primary"><Link href="/accounts">Go to accounts</Link></Button>} />
      </>
    );
  }
  const defaultAccount = filters.accountId !== "all" ? filters.accountId : accounts.length === 1 ? accounts[0].id : "";
  return (
    <>
      <PageHeader title="Add trade" description="Record executions, risk and context. Metrics are calculated as you type." />
      <TradeForm
        initial={emptyTradeValues(profile.timezone, defaultAccount)}
        accounts={accounts.filter((a) => a.is_active)}
        instruments={instruments}
        strategies={strategies.filter((s) => s.is_active)}
        timeZone={profile.timezone}
        knownTags={tags.filter((t) => t.kind === "tag").map((t) => t.name)}
        knownMistakes={tags.filter((t) => t.kind === "mistake").map((t) => t.name)}
      />
    </>
  );
}
