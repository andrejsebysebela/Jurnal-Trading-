"use client";
import { fromZonedTime } from "date-fns-tz";
import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ASSET_CLASSES, computeTrade, TradeCalculationError, type TradeCalcResult } from "@/lib/engine";
import type { Account, Instrument, Strategy } from "@/lib/db/types";
import { duration, money, plain, rMultiple, tone, toneClass } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { tradeFormSchema } from "@/lib/validation/schemas";
import { EMOTIONS, SESSIONS, TIMEFRAMES } from "@/lib/constants";
import { saveTradeAction } from "@/server/actions/trades";


export interface ExecRow { role: "entry" | "exit"; quantity: string; price: string; executedAt: string; fee: string; commission: string }
export interface TradeFormValues {
  id?: string;
  accountId: string;
  symbol: string;
  assetClass: (typeof ASSET_CLASSES)[number];
  direction: "long" | "short";
  quoteCurrency: string;
  executions: ExecRow[];
  stopLoss: string;
  takeProfit: string;
  manualInitialRisk: string;
  swap: string;
  strategyId: string;
  setup: string;
  session: string;
  timeframe: string;
  tagsText: string;
  mistakesText: string;
  emotionalState: string;
  rating: string;
  confidence: string;
  disciplineRating: string;
  ruleCompliant: "" | "yes" | "no";
  checklistState: Record<string, boolean>;
  noteEntryReason: string;
  noteExpectation: string;
  noteExitReason: string;
  noteDidWell: string;
  noteDidWrong: string;
  noteLesson: string;
  notes: string;
}

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function toPayload(v: TradeFormValues, isDraft: boolean) {
  const entrySide = v.direction === "long" ? "buy" : "sell";
  const exitSide = v.direction === "long" ? "sell" : "buy";
  return {
    id: v.id || null,
    accountId: v.accountId,
    symbol: v.symbol,
    assetClass: v.assetClass,
    direction: v.direction,
    quoteCurrency: v.quoteCurrency.toUpperCase(),
    executions: v.executions.map((e) => ({ side: e.role === "entry" ? entrySide : exitSide, quantity: e.quantity, price: e.price, executedAt: e.executedAt, fee: e.fee, commission: e.commission })),
    stopLoss: v.stopLoss, takeProfit: v.takeProfit, manualInitialRisk: v.manualInitialRisk, swap: v.swap,
    strategyId: v.strategyId, setup: v.setup, session: v.session, timeframe: v.timeframe,
    tags: splitList(v.tagsText), mistakes: splitList(v.mistakesText),
    emotionalState: v.emotionalState, rating: v.rating, confidence: v.confidence, disciplineRating: v.disciplineRating,
    ruleCompliant: v.ruleCompliant === "" ? null : v.ruleCompliant === "yes",
    checklistState: v.checklistState,
    noteEntryReason: v.noteEntryReason, noteExpectation: v.noteExpectation, noteExitReason: v.noteExitReason,
    noteDidWell: v.noteDidWell, noteDidWrong: v.noteDidWrong, noteLesson: v.noteLesson, notes: v.notes,
    isDraft,
  };
}

export function TradeForm({ initial, accounts, instruments, strategies, timeZone, knownTags, knownMistakes }: {
  initial: TradeFormValues; accounts: Account[]; instruments: Instrument[]; strategies: Strategy[]; timeZone: string; knownTags: string[]; knownMistakes: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<TradeFormValues>({ defaultValues: initial });
  const { register, control, setValue, formState: { errors } } = form;
  const execs = useFieldArray({ control, name: "executions" });
  const values = useWatch({ control }) as TradeFormValues;

  const instrument = instruments.find((i) => i.symbol === values.symbol?.toUpperCase());
  const account = accounts.find((a) => a.id === values.accountId);
  const strategy = strategies.find((s) => s.id === values.strategyId);

  // Live preview with the same engine the server uses. Server recomputes authoritatively on save.
  const preview = useMemo((): { calc?: TradeCalcResult; error?: string } => {
    if (!account || !values.symbol) return {};
    const p = tradeFormSchema.safeParse(toPayload(values, false));
    if (!p.success) return {};
    try {
      return {
        calc: computeTrade({
          direction: p.data.direction,
          executions: p.data.executions.map((e) => ({ ...e, executedAt: fromZonedTime(e.executedAt, timeZone).toISOString() })),
          instrument: instrument
            ? { symbol: instrument.symbol, assetClass: instrument.asset_class, pointValue: instrument.point_value, contractSize: instrument.contract_size, contractMultiplier: instrument.contract_multiplier, tickSize: instrument.tick_size, tickValue: instrument.tick_value, quoteCurrency: instrument.quote_currency }
            : { symbol: p.data.symbol, assetClass: p.data.assetClass, quoteCurrency: p.data.quoteCurrency ?? account.currency },
          accountCurrency: account.currency,
          stopLoss: p.data.stopLoss, takeProfit: p.data.takeProfit, manualInitialRisk: p.data.manualInitialRisk, swap: p.data.swap,
        }),
      };
    } catch (e) {
      return { error: e instanceof TradeCalculationError ? e.message : "Unable to calculate." };
    }
  }, [values, account, instrument, timeZone]);

  const submit = (isDraft: boolean) =>
    form.handleSubmit((v) => {
      form.clearErrors();
      const payload = toPayload(v, isDraft);
      const parsed = tradeFormSchema.safeParse(payload);
      if (!parsed.success) {
        parsed.error.issues.forEach((i) => form.setError(i.path.join(".") as Path<TradeFormValues>, { message: i.message }));
        toast.error("Please fix the highlighted fields.");
        return;
      }
      start(async () => {
        const res = await saveTradeAction(payload);
        if (!res.ok) {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, msg]) => form.setError(k as Path<TradeFormValues>, { message: msg }));
          toast.error(res.error);
          return;
        }
        toast.success(isDraft ? "Draft saved" : v.id ? "Trade updated" : "Trade saved");
        router.push(`/trades/${res.data.id}`);
        router.refresh();
      });
    })();

  const execsError = (errors.executions as { message?: string } | undefined)?.message ?? errors.executions?.root?.message;
  const execErr = (i: number, f: keyof ExecRow) => (errors.executions?.[i]?.[f] as { message?: string } | undefined)?.message;
  const c = preview.calc;
  const cur = account?.currency ?? "USD";

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="grid gap-5 xl:grid-cols-[1fr_340px]" noValidate>
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Trade</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Account *" error={errors.accountId?.message}>
              <Select {...register("accountId")} aria-invalid={!!errors.accountId}>
                <option value="">Select account…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </Select>
            </Field>
            <Field label="Instrument *" error={errors.symbol?.message} hint={instrument ? (instrument.reviewed ? `${instrument.asset_class} · ${instrument.quote_currency ?? "no currency"}` : "Spec not reviewed yet") : values.symbol ? "New instrument — configure its spec later" : undefined}>
              <Input
                {...register("symbol", {
                  onChange: (e) => {
                    const i = instruments.find((x) => x.symbol === e.target.value.toUpperCase());
                    if (i) { setValue("assetClass", i.asset_class); setValue("quoteCurrency", i.quote_currency ?? ""); }
                  },
                })}
                list="instrument-list" placeholder="EURUSD, ES, AAPL…" className="uppercase" autoComplete="off" aria-invalid={!!errors.symbol}
              />
              <datalist id="instrument-list">{instruments.map((i) => <option key={i.id} value={i.symbol} />)}</datalist>
            </Field>
            <Field label="Asset class *" error={errors.assetClass?.message}>
              <Select {...register("assetClass")} disabled={!!instrument}>
                {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a === "cfd" ? "CFD" : a[0].toUpperCase() + a.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Direction *" group>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-[#0f131a] p-1">
                {(["long", "short"] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setValue("direction", d)} className={cn("h-7 rounded-md text-sm font-medium capitalize transition-colors", values.direction === d ? (d === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss") : "text-muted hover:text-fg")}>{d}</button>
                ))}
              </div>
            </Field>
            {!instrument && (
              <Field label="Quote currency" error={errors.quoteCurrency?.message} hint="Currency P&L is denominated in">
                <Input {...register("quoteCurrency")} maxLength={3} placeholder={cur} className="uppercase" />
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Executions</CardTitle>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => execs.append({ role: "entry", quantity: "", price: "", executedAt: values.executions.at(-1)?.executedAt ?? "", fee: "", commission: "" })}><Plus />Entry</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => execs.append({ role: "exit", quantity: "", price: "", executedAt: values.executions.at(-1)?.executedAt ?? "", fee: "", commission: "" })}><Plus />Exit</Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted">Times in {timeZone}. Add several entries/exits for scale-ins and partial exits; FIFO/LIFO matching follows your settings. Fees and commissions are in the account currency ({cur}).</p>
            <div className="space-y-2">
              <div className="hidden grid-cols-[84px_1fr_1fr_1.4fr_0.8fr_0.8fr_32px] gap-2 px-1 text-[11px] uppercase tracking-wider text-muted md:grid">
                <span>Type</span><span>Quantity</span><span>Price</span><span>Date &amp; time</span><span>Commission</span><span>Fees</span><span />
              </div>
              {execs.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-2 gap-2 rounded-lg border border-line/60 p-2 md:grid-cols-[84px_1fr_1fr_1.4fr_0.8fr_0.8fr_32px] md:border-0 md:p-0" data-testid="exec-row">
                  <Select {...register(`executions.${i}.role`)} aria-label="Execution type" className={values.executions[i]?.role === "entry" ? "text-fg" : "text-gold"}>
                    <option value="entry">Entry</option><option value="exit">Exit</option>
                  </Select>
                  <div><Input {...register(`executions.${i}.quantity`)} inputMode="decimal" placeholder="Qty" aria-label="Quantity" aria-invalid={!!execErr(i, "quantity")} />{execErr(i, "quantity") && <p className="mt-0.5 text-[11px] text-loss">{execErr(i, "quantity")}</p>}</div>
                  <div><Input {...register(`executions.${i}.price`)} inputMode="decimal" placeholder="Price" aria-label="Price" aria-invalid={!!execErr(i, "price")} />{execErr(i, "price") && <p className="mt-0.5 text-[11px] text-loss">{execErr(i, "price")}</p>}</div>
                  <div className="col-span-2 md:col-span-1"><Input type="datetime-local" step={1} {...register(`executions.${i}.executedAt`)} aria-label="Execution time" aria-invalid={!!execErr(i, "executedAt")} />{execErr(i, "executedAt") && <p className="mt-0.5 text-[11px] text-loss">{execErr(i, "executedAt")}</p>}</div>
                  <Input {...register(`executions.${i}.commission`)} inputMode="decimal" placeholder="0" aria-label="Commission" />
                  <Input {...register(`executions.${i}.fee`)} inputMode="decimal" placeholder="0" aria-label="Fees" />
                  <Button type="button" variant="ghost" size="icon" className="size-9" disabled={execs.fields.length <= 1} onClick={() => execs.remove(i)} aria-label="Remove execution"><Trash2 /></Button>
                </div>
              ))}
            </div>
            {(execsError || preview.error) && (
              <p className="mt-3 flex items-center gap-2 text-sm text-loss"><AlertTriangle className="size-4" />{preview.error ?? execsError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Risk</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Stop loss" error={errors.stopLoss?.message}><Input {...register("stopLoss")} inputMode="decimal" /></Field>
            <Field label="Take profit" error={errors.takeProfit?.message}><Input {...register("takeProfit")} inputMode="decimal" /></Field>
            <Field label={`Initial risk (${cur})`} error={errors.manualInitialRisk?.message} hint="Overrides stop-based risk"><Input {...register("manualInitialRisk")} inputMode="decimal" /></Field>
            <Field label={`Swap / financing (${cur})`} error={errors.swap?.message} hint="Negative = cost"><Input {...register("swap")} inputMode="decimal" /></Field>
          </CardContent>
        </Card>

        <Card>
          <Tabs defaultValue="setup">
            <div className="px-5 pt-3"><TabsList><TabsTrigger value="setup">Setup</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="psychology">Psychology</TabsTrigger></TabsList></div>
            <TabsContent value="setup" className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
              <Field label="Strategy">
                <Select {...register("strategyId")}><option value="">None</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </Field>
              <Field label="Setup"><Input {...register("setup")} placeholder="e.g. Opening range breakout" /></Field>
              <Field label="Session"><Select {...register("session")}><option value="">—</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Timeframe"><Select {...register("timeframe")}><option value="">—</option>{TIMEFRAMES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Tags" className="col-span-2" hint="Comma separated"><Input {...register("tagsText")} list="tag-list" placeholder="A+ setup, news" /><datalist id="tag-list">{knownTags.map((t) => <option key={t} value={t} />)}</datalist></Field>
              <Field label="Rating"><Select {...register("rating")}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</Select></Field>
              {strategy && strategy.checklist.length > 0 && (
                <div className="col-span-2 md:col-span-4">
                  <p className="mb-2 text-xs font-medium text-fg-2">{strategy.name} checklist</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {strategy.checklist.map((item) => (
                      <label key={item} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg-2">
                        <input type="checkbox" className="accent-[#C6A15B]" checked={!!values.checklistState?.[item]} onChange={(e) => setValue("checklistState", { ...values.checklistState, [item]: e.target.checked })} />{item}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="notes" className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Why I entered"><Textarea {...register("noteEntryReason")} /></Field>
              <Field label="What I expected"><Textarea {...register("noteExpectation")} /></Field>
              <Field label="Why I exited"><Textarea {...register("noteExitReason")} /></Field>
              <Field label="What I did well"><Textarea {...register("noteDidWell")} /></Field>
              <Field label="What I did wrong"><Textarea {...register("noteDidWrong")} /></Field>
              <Field label="What I learned"><Textarea {...register("noteLesson")} /></Field>
              <Field label="Other notes" className="md:col-span-2"><Textarea {...register("notes")} /></Field>
            </TabsContent>
            <TabsContent value="psychology" className="grid grid-cols-2 gap-4 p-5 md:grid-cols-3">
              <Field label="Emotional state"><Select {...register("emotionalState")}><option value="">—</option>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Confidence (1–10)"><Select {...register("confidence")}><option value="">—</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</Select></Field>
              <Field label="Discipline (1–10)"><Select {...register("disciplineRating")}><option value="">—</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</Select></Field>
              <Field label="Followed my rules?"><Select {...register("ruleCompliant")}><option value="">Not reviewed</option><option value="yes">Yes</option><option value="no">No</option></Select></Field>
              <Field label="Mistakes" className="col-span-2" hint="Comma separated"><Input {...register("mistakesText")} list="mistake-list" placeholder="FOMO, moved stop" /><datalist id="mistake-list">{knownMistakes.map((t) => <option key={t} value={t} />)}</datalist></Field>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader><CardTitle>Calculated</CardTitle>{c && <Badge tone={c.status === "open" ? "gold" : "neutral"}>{c.status}</Badge>}</CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {!c ? (
              <p className="text-muted">Enter account, instrument and valid executions to see live metrics.</p>
            ) : (
              <>
                <Row label="Net P&L" value={c.netPnl ? <span className={toneClass[tone(c.netPnl)]}>{money(c.netPnl, cur, { sign: true })}</span> : <span className="text-muted">Unavailable</span>} big />
                <Row label="Gross P&L" value={money(c.grossPnl, cur, { sign: true })} />
                <Row label="Fees" value={money(c.fees, cur)} />
                <Row label="R-multiple" value={rMultiple(c.rMultiple)} />
                <Row label="Initial risk" value={money(c.initialRisk, cur)} />
                <Row label="Planned R:R" value={c.plannedRewardRisk ? `1 : ${Number(c.plannedRewardRisk).toFixed(2)}` : "—"} />
                <Row label="Avg entry" value={plain(c.avgEntryPrice)} />
                <Row label="Avg exit" value={plain(c.avgExitPrice)} />
                <Row label="Position" value={`${plain(c.entryQuantity)}${c.status === "open" ? ` (${plain(c.openQuantity)} open)` : ""}`} />
                <Row label="Holding" value={duration(c.holdingSeconds)} />
                {c.issues.filter((i) => i.severity !== "info" || i.code === "NO_STOP_LOSS").map((i) => (
                  <p key={i.code + i.message} className="flex gap-2 rounded-lg bg-gold/[0.07] p-2 text-xs text-fg-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold" />{i.message}</p>
                ))}
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2">
          <Button type="submit" variant="primary" size="lg" disabled={pending}><Save />{pending ? "Saving…" : initial.id ? "Save changes" : "Save trade"}</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => submit(true)}>Save as draft</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value, big }: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-2">{label}</span>
      <span className={cn("num text-right", big ? "text-lg font-semibold" : "text-fg")}>{value}</span>
    </div>
  );
}
