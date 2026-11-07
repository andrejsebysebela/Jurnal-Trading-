import { ClipboardList, Pencil, Plus } from "lucide-react";
import { StrategyDialog } from "@/components/forms/strategy-dialog";
import { RulesManager } from "@/components/journal/rules-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarize } from "@/lib/analytics";
import { listAccounts, listRules, listStrategies, listTrades, toAnalytics } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { pct } from "@/lib/utils/format";

export const metadata = { title: "Playbook" };

export default async function PlaybookPage() {
  const { supabase, profile } = await requireUser();
  const [strategies, rules, rows, accounts] = await Promise.all([listStrategies(supabase), listRules(supabase), listTrades(supabase), listAccounts(supabase)]);
  // Only aggregate accounts in the base currency — never sum across currencies.
  const base = new Set(accounts.filter((a) => a.currency === profile.base_currency).map((a) => a.id));
  const trades = toAnalytics(rows.filter((r) => base.has(r.account_id)), strategies);

  return (
    <>
      <PageHeader title="Playbook" description="Your documented setups and trading rules. A plan you can measure yourself against." actions={<StrategyDialog trigger={<Button variant="primary"><Plus />New play</Button>} />} />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          {!strategies.length && <EmptyState icon={ClipboardList} title="Your playbook is empty" description="Document each setup: when it applies, how to enter, how to exit and how to manage risk." />}
          {strategies.map((s) => {
            const list = trades.filter((t) => t.strategyId === s.id);
            const sum = summarize(list);
            const followed = list.filter((t) => t.ruleCompliant !== null);
            return (
              <Card key={s.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color }} /><CardTitle className="text-base">{s.name}</CardTitle>{s.timeframe && <Badge>{s.timeframe}</Badge>}{!s.is_active && <Badge>inactive</Badge>}</div>
                  <StrategyDialog strategy={s} trigger={<Button variant="ghost" size="sm"><Pencil />Edit</Button>} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-2">
                    <span>All-time ({profile.base_currency} accounts): <Pnl value={sum.netPnl} currency={profile.base_currency} /></span>
                    <span>{sum.totalTrades} trades</span><span>Win rate {pct(sum.winRate)}</span>
                    <span>Rules followed {followed.length ? pct((followed.filter((t) => t.ruleCompliant).length / followed.length) * 100) : "—"}</span>
                  </div>
                  {s.description && <p className="text-sm text-fg-2">{s.description}</p>}
                  <div className="grid gap-4 md:grid-cols-2">
                    {[["Market conditions", s.market_conditions], ["Entry criteria", s.entry_criteria], ["Exit criteria", s.exit_criteria], ["Risk rules", s.risk_rules]].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-elevated/50 p-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gold">{k}</p><p className="whitespace-pre-wrap text-sm text-fg-2">{v || <span className="text-muted">Not documented</span>}</p></div>
                    ))}
                  </div>
                  {s.checklist.length > 0 && (
                    <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Checklist</p><ul className="grid gap-1.5 sm:grid-cols-2">{s.checklist.map((c) => <li key={c} className="flex items-center gap-2 text-sm text-fg-2"><span className="size-1.5 rounded-full bg-gold" />{c}</li>)}</ul></div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="self-start">
          <CardHeader><CardTitle>Trading rules</CardTitle></CardHeader>
          <CardContent><RulesManager rules={rules} /></CardContent>
        </Card>
      </div>
    </>
  );
}
