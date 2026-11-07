"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { accountKind, accountPhaseKey, type AccountKind, type AccountPhase } from "@/components/accounts/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import type { Account } from "@/lib/db/types";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import { inputDec } from "@/lib/utils/format";
import { accountSchema } from "@/lib/validation/schemas";
import { saveAccount } from "@/server/actions/management";

const PHASES: Record<AccountKind, AccountPhase[]> = { prop: ["challenge", "verification", "funded"], personal: ["live", "demo"] };

export function AccountDialog({ account, trigger }: { account?: Account; trigger: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const init = () => ({
    id: account?.id ?? "", name: account?.name ?? "", kind: (account ? accountKind(account) : "prop") as AccountKind,
    phase: (account ? accountPhaseKey(account) : "challenge") as AccountPhase, propFirm: account?.prop_firm ?? "",
    currency: account?.currency ?? "USD", startingBalance: inputDec(account?.starting_balance), profitTarget: inputDec(account?.profit_target),
    maxDailyLoss: inputDec(account?.max_daily_loss), maxTotalDrawdown: inputDec(account?.max_total_drawdown),
    drawdownType: account?.drawdown_type ?? "static", isActive: account?.is_active ?? true,
  });
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ReturnType<typeof init>>(k: K, val: ReturnType<typeof init>[K]) => setV((p) => ({ ...p, [k]: val }));
  const setKind = (kind: AccountKind) => setV((p) => ({ ...p, kind, phase: PHASES[kind][0] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = accountSchema(t).safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { const k = String(i.path[0]); if (!errs[k]) errs[k] = i.message; });
      setErrors(errs);
      return;
    }
    start(async () => {
      const r = await saveAccount(v);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      toast.success(account ? t.accounts.updated : t.accounts.created);
      setOpen(false);
      if (!account) setV(init());
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(init()); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={account ? t.accounts.edit : t.accounts.new}>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
          <Field label={t.accounts.name} error={errors.name} className="col-span-2"><Input name="name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder={t.accounts.namePlaceholder} aria-invalid={!!errors.name} /></Field>
          <Field label={t.accounts.type} group className="col-span-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-[#0f131a] p-1">
              {(["prop", "personal"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => setKind(k)} className={cn("h-8 rounded-md text-sm font-medium transition-colors", v.kind === k ? "bg-elevated text-gold" : "text-muted hover:text-fg")}>{t.account[k]}</button>
              ))}
            </div>
          </Field>
          <Field label={t.accounts.phase} group className="col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {PHASES[v.kind].map((p) => (
                <button key={p} type="button" aria-pressed={v.phase === p} onClick={() => set("phase", p)} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", v.phase === p ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-fg-2 hover:text-fg")}>{t.account.phase[p]}</button>
              ))}
            </div>
          </Field>
          {v.kind === "prop" && <Field label={t.accounts.propFirm} className="col-span-2"><Input value={v.propFirm} onChange={(e) => set("propFirm", e.target.value)} placeholder={t.accounts.propFirmPlaceholder} /></Field>}
          <Field label={t.accounts.currency} error={errors.currency} hint={t.accounts.currencyHint}><Input value={v.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} className="uppercase" aria-invalid={!!errors.currency} /></Field>
          <Field label={t.accounts.startingBalance} error={errors.startingBalance}><Input value={v.startingBalance} onChange={(e) => set("startingBalance", e.target.value)} inputMode="decimal" placeholder="100000" aria-invalid={!!errors.startingBalance} /></Field>
          {v.kind === "prop" && (
            <>
              <div className="col-span-2 mt-1 border-t border-line pt-4 text-xs font-semibold uppercase tracking-wider text-gold">{t.accounts.rules} <span className="font-normal normal-case tracking-normal text-muted">({t.common.optional})</span></div>
              <Field label={t.accounts.profitTarget} error={errors.profitTarget}><Input value={v.profitTarget} onChange={(e) => set("profitTarget", e.target.value)} inputMode="decimal" placeholder="10000" /></Field>
              <Field label={t.accounts.maxDailyLoss} error={errors.maxDailyLoss}><Input value={v.maxDailyLoss} onChange={(e) => set("maxDailyLoss", e.target.value)} inputMode="decimal" placeholder="5000" /></Field>
              <Field label={t.accounts.maxDrawdown} error={errors.maxTotalDrawdown}><Input value={v.maxTotalDrawdown} onChange={(e) => set("maxTotalDrawdown", e.target.value)} inputMode="decimal" placeholder="10000" /></Field>
              <Field label={t.accounts.drawdownType}><Select value={v.drawdownType} onChange={(e) => set("drawdownType", e.target.value as "static" | "trailing")}><option value="static">{t.accounts.drawdownStatic}</option><option value="trailing">{t.accounts.drawdownTrailing}</option></Select></Field>
            </>
          )}
          <label className="col-span-2 flex items-center gap-2 text-sm text-fg-2"><input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-[#C6A15B]" />{t.accounts.active}</label>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? t.common.saving : t.common.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
