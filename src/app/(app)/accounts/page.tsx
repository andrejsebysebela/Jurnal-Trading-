import { formatInTimeZone } from "date-fns-tz";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { AccountSummary } from "@/components/accounts/account-summary";
import { ViewStatsButton } from "@/components/accounts/view-stats-button";
import { AccountDialog } from "@/components/forms/account-dialog";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAccounts, listTrades, toAnalytics } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { fill } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { deleteAccount } from "@/server/actions/management";

export async function generateMetadata() {
  return { title: (await getI18n()).t.accounts.title };
}

export default async function AccountsPage() {
  const { supabase, profile } = await requireUser();
  const { t, f } = await getI18n();
  const accounts = await listAccounts(supabase);
  const all = toAnalytics(await listTrades(supabase));
  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");
  const newBtn = <AccountDialog trigger={<Button variant="primary"><Plus />{t.accounts.new}</Button>} />;

  return (
    <>
      <PageHeader title={t.accounts.title} description={t.accounts.subtitle} actions={newBtn} />
      {!accounts.length ? (
        <EmptyState icon={Wallet} title={t.accounts.emptyTitle} description={t.accounts.emptyBody} action={newBtn} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((a) => {
            const trades = all.filter((x) => x.accountId === a.id);
            return (
              <Card key={a.id} className="p-5" data-testid="account-card">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold">{a.name}</h3>
                    <p className="text-xs text-muted">{a.currency}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ViewStatsButton accountId={a.id} />
                    <AccountDialog account={a} trigger={<Button variant="ghost" size="icon" aria-label={`${t.common.edit} ${a.name}`}><Pencil /></Button>} />
                    <ConfirmButton variant="ghost" size="icon" aria-label={`${t.common.delete} ${a.name}`} action={deleteAccount.bind(null, a.id)} title={fill(t.accounts.deleteTitle, { name: a.name })} description={fill(t.accounts.deleteBody, { count: trades.length })} success={t.accounts.deleted}><Trash2 /></ConfirmButton>
                  </div>
                </div>
                <AccountSummary a={a} trades={trades} t={t} f={f} timeZone={profile.timezone} today={today} />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
