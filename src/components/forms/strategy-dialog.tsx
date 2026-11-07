"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { TIMEFRAMES } from "@/lib/constants";
import type { Strategy } from "@/lib/db/types";
import { strategySchema, type StrategyFormInput } from "@/lib/validation/schemas";
import { saveStrategy } from "@/server/actions/management";
import { useActionSubmit } from "./use-action-form";

const COLORS = ["#C6A15B", "#5B8DEF", "#39B980", "#B07FE0", "#E0884F", "#4FB8C4", "#D4699A"];

export function StrategyDialog({ strategy, trigger }: { strategy?: Strategy; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState("");
  const form = useForm<StrategyFormInput>({
    resolver: zodResolver(strategySchema),
    defaultValues: {
      id: strategy?.id, name: strategy?.name ?? "", description: strategy?.description ?? "", timeframe: strategy?.timeframe ?? "",
      marketConditions: strategy?.market_conditions ?? "", entryCriteria: strategy?.entry_criteria ?? "", exitCriteria: strategy?.exit_criteria ?? "",
      riskRules: strategy?.risk_rules ?? "", checklist: strategy?.checklist ?? [], color: strategy?.color ?? COLORS[0], isActive: strategy?.is_active ?? true,
    },
  });
  const checklist = (useWatch({ control: form.control, name: "checklist" }) ?? []) as string[];
  const color = useWatch({ control: form.control, name: "color" });
  const { submit, pending } = useActionSubmit(form, saveStrategy, { success: "Strategy saved", onSuccess: () => { setOpen(false); if (!strategy) form.reset(); } });
  const add = () => { const v = item.trim(); if (v && !checklist.includes(v)) form.setValue("checklist", [...checklist, v]); setItem(""); };
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right" title={strategy ? `Edit ${strategy.name}` : "New strategy"} description="Define the setup once; link trades to it to measure its edge.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Name" error={e.name?.message}><Input {...form.register("name")} placeholder="Opening range breakout" /></Field>
            <Field label="Timeframe"><Select {...form.register("timeframe")}><option value="">—</option>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-2">Color</p>
            <div className="flex gap-2">{COLORS.map((c) => <button type="button" key={c} onClick={() => form.setValue("color", c)} aria-label={`Color ${c}`} className={`size-6 rounded-full ring-offset-2 ring-offset-card ${color === c ? "ring-2 ring-fg" : ""}`} style={{ background: c }} />)}</div>
          </div>
          <Field label="Description"><Textarea {...form.register("description")} /></Field>
          <Field label="Market conditions"><Textarea {...form.register("marketConditions")} placeholder="Trending, high volume, after news…" /></Field>
          <Field label="Entry criteria"><Textarea {...form.register("entryCriteria")} /></Field>
          <Field label="Exit criteria"><Textarea {...form.register("exitCriteria")} /></Field>
          <Field label="Risk rules"><Textarea {...form.register("riskRules")} placeholder="Max 1% per trade, stop below structure…" /></Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-2">Entry checklist</p>
            <div className="flex gap-2"><Input value={item} onChange={(ev) => setItem(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); add(); } }} placeholder="e.g. Higher-timeframe trend aligned" /><Button type="button" variant="secondary" onClick={add}><Plus />Add</Button></div>
            <ul className="mt-2 space-y-1">
              {checklist.map((c) => (
                <li key={c} className="flex items-center justify-between rounded-lg bg-elevated px-3 py-1.5 text-sm">{c}<button type="button" aria-label={`Remove ${c}`} onClick={() => form.setValue("checklist", checklist.filter((x) => x !== c))} className="text-muted hover:text-loss"><X className="size-4" /></button></li>
              ))}
            </ul>
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-2"><input type="checkbox" {...form.register("isActive")} className="accent-[#C6A15B]" />Active</label>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save strategy"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
