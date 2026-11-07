import { formatInTimeZone } from "date-fns-tz";
import { Pencil, Plus, ShieldAlert, Trash2, Wallet } from "lucide-react";
import { AccountDialog } from "@/components/forms/account-dialog";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bar";
import { Pnl } from "@/components/shared/pnl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { propStatus, summarize } from "@/lib/analytics";
import { D } from "@/lib/engine";
import { listAccounts, listTrades, toAnalytics } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { money, pct } from "@/lib/utils/format";
import { deleteAccount } from "@/server/actions/management";

// Server actions on this page (import / recalculation) may run longer than the default.
export const maxDuration = 60;
export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { supabase, profile } = await requireUser();
  const accounts = await listAccounts(supabase);
  const all = toAnalytics(await listTrades(supabase));
  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");

  return (
    <>
      <PageHeader title="Accounts" description="Trading accounts, balances and prop firm limits. Metrics here are all-time." actions={<AccountDialog trigger={<Button variant="primary"><Plus />New account</Button>} />} />
      {!accounts.length ? (
        <EmptyState icon={Wallet} title="No accounts yet" description="Create an account to start recording trades. Each account has its own currency." action={<AccountDialog trigger={<Button variant="primary"><Plus />Create account</Button>} />} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((a) => {
            const trades = all.filter((t) => t.accountId === a.id);
            const s = summarize(trades, { startingBalance: a.starting_balance });
            const isProp = a.account_type === "prop";
            const ps = isProp ? propStatus(trades, { startingBalance: a.starting_balance, profitTarget: a.profit_target, maxDailyLoss: a.max_daily_loss, maxTotalDrawdown: a.max_total_drawdown, drawdownType: a.drawdown_type }, profile.timezone, today) : null;
            return (
              <Card key={a.id} className="p-5" data-testid="account-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{a.name}</h3>
                      <Badge tone={isProp ? "gold" : "neutral"}>{a.account_type}</Badge>
                      {!a.is_active && <Badge>inactive</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{[a.broker, a.prop_firm, a.currency].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex gap-1">
                    <AccountDialog account={a} trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${a.name}`}><Pencil /></Button>} />
                    <ConfirmButton variant="ghost" size="icon" aria-label={`Delete ${a.name}`} action={deleteAccount.bind(null, a.id)} title={`Delete ${a.name}?`} description={`This permanently deletes the account and its ${trades.length} trade(s), executions and screenshots.`} success="Account deleted"><Trash2 /></ConfirmButton>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metric label="Balance" value={a.starting_balance ? money(addDec(a.starting_balance, s.netPnl), a.currency) : "—"} />
                  <Metric label="Net P&L" value={<Pnl value={s.netPnl} currency={a.currency} />} />
                  <Metric label="Trades" value={String(s.totalTrades)} />
                  <Metric label="Win rate" value={pct(s.winRate)} />
                </div>
                {ps && (
                  <div className="mt-5 space-y-3 rounded-xl border border-line bg-elevated/40 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-gold"><ShieldAlert className="size-3.5" />Prop rules</span>
                      <Badge tone={ps.status === "breached" || ps.status === "danger" ? "loss" : ps.status === "warning" ? "warning" : ps.status === "passed" ? "profit" : "neutral"}>{ps.status}</Badge>
                    </div>
                    {a.profit_target && <Rule label="Profit target" detail={`${money(ps.netPnl, a.currency)} / ${money(a.profit_target, a.currency)}`} value={ps.profitTargetProgressPct} tone="profit" />}
                    {a.max_daily_loss && <Rule label="Daily loss used (today)" detail={`${money(ps.todayPnl, a.currency, { sign: true })} / -${money(a.max_daily_loss, a.currency)}`} value={ps.dailyLossUsedPct} tone={(ps.dailyLossUsedPct ?? 0) >= 80 ? "loss" : (ps.dailyLossUsedPct ?? 0) >= 50 ? "warn" : "gold"} />}
                    {a.max_total_drawdown && <Rule label={`Drawdown used (${a.drawdown_type})`} detail={`${money(ps.drawdownUsed, a.currency)} / ${money(a.max_total_drawdown, a.currency)} · ${money(ps.remainingDrawdown, a.currency)} left`} value={ps.drawdownUsedPct} tone={(ps.drawdownUsedPct ?? 0) >= 80 ? "loss" : (ps.drawdownUsedPct ?? 0) >= 50 ? "warn" : "gold"} />}
                    <p className="text-[11px] text-muted">Based on realized P&amp;L of closed trades. Open-position equity is not included.</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function addDec(a: string, b: string) { return new D(a).plus(b).toFixed(); }

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-[11px] uppercase tracking-wider text-muted">{label}</p><p className="num mt-1 text-sm font-semibold">{value}</p></div>;
}

function Rule({ label, detail, value, tone }: { label: string; detail: string; value: number | null; tone: "gold" | "profit" | "loss" | "warn" }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs"><span className="text-fg-2">{label}</span><span className="num text-muted">{detail}</span></div>
      <ProgressBar value={value} tone={tone} label={label} />
    </div>
  );
}
