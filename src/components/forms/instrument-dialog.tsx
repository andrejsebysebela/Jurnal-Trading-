"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ASSET_CLASSES, pnlMultiplier } from "@/lib/engine";
import type { Instrument } from "@/lib/db/types";
import { inputDec } from "@/lib/utils/format";
import { instrumentSchema, type InstrumentFormInput } from "@/lib/validation/schemas";
import { saveInstrument } from "@/server/actions/management";
import { useActionSubmit } from "./use-action-form";

const HELP: Record<string, string> = {
  forex: "Quantity is in lots. Set the contract size (units per lot) your broker uses.",
  cfd: "Quantity is in lots/contracts. Contract size varies by broker — copy it from your broker's specification.",
  futures: "Set point value, or tick size + tick value, from the exchange/broker specification.",
  stock: "Quantity is shares; 1 point = 1 unit of quote currency per share unless you set a multiplier.",
  crypto: "Quantity is coins/units; set a multiplier only for contract-based products.",
};

export function InstrumentDialog({ instrument, trigger }: { instrument?: Instrument; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<InstrumentFormInput>({
    resolver: zodResolver(instrumentSchema),
    defaultValues: {
      id: instrument?.id, symbol: instrument?.symbol ?? "", assetClass: instrument?.asset_class ?? "forex", description: instrument?.description ?? "",
      pointValue: inputDec(instrument?.point_value), contractSize: inputDec(instrument?.contract_size), contractMultiplier: inputDec(instrument?.contract_multiplier),
      tickSize: inputDec(instrument?.tick_size), tickValue: inputDec(instrument?.tick_value), quoteCurrency: instrument?.quote_currency ?? "",
      baseCurrency: instrument?.base_currency ?? "", lotStep: inputDec(instrument?.lot_step), minLot: inputDec(instrument?.min_lot),
    },
  });
  const v = useWatch({ control: form.control }) as InstrumentFormInput;
  const m = pnlMultiplier({ symbol: v.symbol || "?", assetClass: v.assetClass ?? "forex", pointValue: (v.pointValue as string) || null, contractSize: (v.contractSize as string) || null, contractMultiplier: (v.contractMultiplier as string) || null, tickSize: (v.tickSize as string) || null, tickValue: (v.tickValue as string) || null });
  const { submit, pending } = useActionSubmit(form, saveInstrument, { success: (r) => `Instrument saved · ${r.recalculated} trade(s) recalculated`, onSuccess: () => setOpen(false) });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={instrument ? `${instrument.symbol} specification` : "New instrument"} description="EDGELOG never guesses contract specs. Copy them from your broker or exchange.">
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field label="Symbol" error={e.symbol?.message}><Input {...form.register("symbol")} className="uppercase" /></Field>
          <Field label="Asset class"><Select {...form.register("assetClass")}>{ASSET_CLASSES.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
          <p className="col-span-2 -mt-1 text-xs text-muted">{HELP[v.assetClass ?? "forex"]}</p>
          <Field label="Quote / P&L currency" error={e.quoteCurrency?.message}><Input {...form.register("quoteCurrency")} maxLength={3} className="uppercase" placeholder="USD" /></Field>
          <Field label="Base currency" error={e.baseCurrency?.message}><Input {...form.register("baseCurrency")} maxLength={3} className="uppercase" /></Field>
          <Field label="Contract size (units/lot)" error={e.contractSize?.message}><Input {...form.register("contractSize")} inputMode="decimal" /></Field>
          <Field label="Contract multiplier" error={e.contractMultiplier?.message}><Input {...form.register("contractMultiplier")} inputMode="decimal" /></Field>
          <Field label="Tick size" error={e.tickSize?.message}><Input {...form.register("tickSize")} inputMode="decimal" /></Field>
          <Field label="Tick value" error={e.tickValue?.message}><Input {...form.register("tickValue")} inputMode="decimal" /></Field>
          <Field label="Point value (overrides others)" error={e.pointValue?.message}><Input {...form.register("pointValue")} inputMode="decimal" /></Field>
          <Field label="Description"><Input {...form.register("description")} /></Field>
          <Field label="Lot step" error={e.lotStep?.message}><Input {...form.register("lotStep")} inputMode="decimal" /></Field>
          <Field label="Minimum lot" error={e.minLot?.message}><Input {...form.register("minLot")} inputMode="decimal" /></Field>
          <div className={`col-span-2 rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-profit/10 text-fg-2" : "bg-gold/[0.08] text-fg-2"}`}>
            {m.ok ? <>1.0 price move × 1 quantity = <span className="num font-semibold text-fg">{m.multiplier.toFixed()}</span> {(v.quoteCurrency as string) || "quote currency"} <span className="text-muted">({m.basis})</span></> : m.reason}
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving & recalculating…" : "Save & mark reviewed"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
