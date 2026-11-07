"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import type { Account } from "@/lib/db/types";
import { inputDec } from "@/lib/utils/format";
import { accountSchema, type AccountFormInput } from "@/lib/validation/schemas";
import { saveAccount } from "@/server/actions/management";
import { useActionSubmit } from "./use-action-form";

const dec = (v: string | null) => inputDec(v);

export function AccountDialog({ account, trigger }: { account?: Account; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<AccountFormInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      id: account?.id, name: account?.name ?? "", broker: account?.broker ?? "", accountType: account?.account_type ?? "live",
      currency: account?.currency ?? "USD", startingBalance: dec(account?.starting_balance ?? null), propFirm: account?.prop_firm ?? "",
      profitTarget: dec(account?.profit_target ?? null), maxDailyLoss: dec(account?.max_daily_loss ?? null),
      maxTotalDrawdown: dec(account?.max_total_drawdown ?? null), drawdownType: account?.drawdown_type ?? "static", isActive: account?.is_active ?? true,
    },
  });
  const type = useWatch({ control: form.control, name: "accountType" });
  const { submit, pending } = useActionSubmit(form, saveAccount, { success: account ? "Account updated" : "Account created", onSuccess: () => { setOpen(false); if (!account) form.reset(); } });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={account ? "Edit account" : "New account"} description="Money values are in the account currency.">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field label="Name" error={e.name?.message} className="col-span-2"><Input {...form.register("name")} placeholder="Main account" /></Field>
          <Field label="Broker" error={e.broker?.message}><Input {...form.register("broker")} placeholder="Broker name" /></Field>
          <Field label="Type"><Select {...form.register("accountType")}><option value="live">Live</option><option value="demo">Demo</option><option value="prop">Prop firm</option><option value="paper">Paper</option></Select></Field>
          <Field label="Currency" error={e.currency?.message}><Input {...form.register("currency")} maxLength={3} className="uppercase" /></Field>
          <Field label="Starting balance" error={e.startingBalance?.message}><Input {...form.register("startingBalance")} inputMode="decimal" placeholder="10000" /></Field>
          {type === "prop" && (
            <>
              <div className="col-span-2 mt-1 border-t border-line pt-4 text-xs font-semibold uppercase tracking-wider text-gold">Prop firm rules</div>
              <Field label="Prop firm" error={e.propFirm?.message}><Input {...form.register("propFirm")} /></Field>
              <Field label="Profit target" error={e.profitTarget?.message}><Input {...form.register("profitTarget")} inputMode="decimal" /></Field>
              <Field label="Max daily loss" error={e.maxDailyLoss?.message}><Input {...form.register("maxDailyLoss")} inputMode="decimal" /></Field>
              <Field label="Max total drawdown" error={e.maxTotalDrawdown?.message}><Input {...form.register("maxTotalDrawdown")} inputMode="decimal" /></Field>
              <Field label="Drawdown type" className="col-span-2" hint="Static: measured from starting balance. Trailing: from the highest realized balance.">
                <Select {...form.register("drawdownType")}><option value="static">Static</option><option value="trailing">Trailing (realized)</option></Select>
              </Field>
            </>
          )}
          <label className="col-span-2 flex items-center gap-2 text-sm text-fg-2"><input type="checkbox" {...form.register("isActive")} className="accent-[#C6A15B]" /> Active</label>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save account"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
