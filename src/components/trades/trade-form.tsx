"use client";
import { fromZonedTime } from "date-fns-tz";
import { ExternalLink, ImagePlus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EMOTIONS, emotionKey } from "@/lib/constants";
import { computeSimpleTrade, SimpleTradeError } from "@/lib/engine/simple";
import type { Account, Screenshot } from "@/lib/db/types";
import { useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import { tone, toneClass } from "@/lib/utils/format";
import { simpleTradeSchema } from "@/lib/validation/schemas";
import { saveTradeAction } from "@/server/actions/trades";
import { acceptFiles, ScreenshotGallery, SCREENSHOT_TYPES, uploadScreenshots } from "./screenshots";

export interface TradeFormValues {
  id?: string;
  accountId: string;
  symbol: string;
  direction: "long" | "short";
  openedAt: string;
  closedAt: string;
  risk: string;
  result: string;
  plannedRR: string;
  emotion: string;
  psychology: string;
  notes: string;
  tradingviewUrl: string;
}

export function TradeForm({ initial, accounts, symbols, timeZone, userId, screenshots = [] }: {
  initial: TradeFormValues; accounts: Account[]; symbols: string[]; timeZone: string; userId: string; screenshots?: Screenshot[];
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [v, setV] = useState<TradeFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const account = accounts.find((a) => a.id === v.accountId);
  const cur = account?.currency ?? "USD";
  const set = <K extends keyof TradeFormValues>(k: K, val: TradeFormValues[K]) => { setV((p) => ({ ...p, [k]: val })); if (errors[k]) setErrors((e) => ({ ...e, [k]: "" })); };

  // Live preview using the same calculation the server runs on save.
  const preview = useMemo(() => {
    try {
      if (!v.risk || !v.result || !v.openedAt || !v.closedAt) return null;
      const n = (s: string) => s.trim().replace(/\s/g, "").replace(",", ".");
      return computeSimpleTrade({ risk: n(v.risk), result: n(v.result), plannedRR: v.plannedRR ? n(v.plannedRR) : null, openedAt: fromZonedTime(v.openedAt, timeZone).toISOString(), closedAt: fromZonedTime(v.closedAt, timeZone).toISOString() });
    } catch (e) {
      return e instanceof SimpleTradeError ? null : null;
    }
  }, [v.risk, v.result, v.plannedRR, v.openedAt, v.closedAt, timeZone]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = simpleTradeSchema(t).safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { const k = String(i.path[0]); if (!errs[k]) errs[k] = i.message; });
      setErrors(errs);
      toast.error(t.common.fixFields);
      return;
    }
    start(async () => {
      const res = await saveTradeAction(v);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast.error(res.error); return; }
      if (files.length) await uploadScreenshots(userId, res.data.id, files);
      toast.success(v.id ? t.trade.updated : t.trade.saved);
      router.push(`/trades/${res.data.id}`);
      router.refresh();
    });
  };

  const emotionValue = emotionKey(v.emotion);

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_320px]" noValidate>
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>{t.trade.pair}</CardTitle><span className="text-xs text-muted">{fill(t.trade.currencyNote, { currency: cur })}</span></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label={`${t.trade.account} *`} error={errors.accountId}>
              <Select value={v.accountId} onChange={(e) => set("accountId", e.target.value)} aria-invalid={!!errors.accountId}>
                <option value="">{t.trade.selectAccount}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </Select>
            </Field>
            <Field label={`${t.trade.pair} *`} error={errors.symbol}>
              <Input value={v.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} list="pair-list" placeholder={t.trade.pairPlaceholder} autoComplete="off" className="uppercase" aria-invalid={!!errors.symbol} />
              <datalist id="pair-list">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label={`${t.trade.direction} *`} group>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-[#0f131a] p-1">
                {(["long", "short"] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={v.direction === d} onClick={() => set("direction", d)}
                    className={cn("h-7 rounded-md text-sm font-medium transition-colors", v.direction === d ? (d === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss") : "text-muted hover:text-fg")}>
                    {d === "long" ? t.common.long : t.common.short}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`${t.trade.openDate} *`} error={errors.openedAt}>
              <Input type="datetime-local" value={v.openedAt} onChange={(e) => set("openedAt", e.target.value)} aria-invalid={!!errors.openedAt} />
            </Field>
            <Field label={`${t.trade.closeDate} *`} error={errors.closedAt}>
              <Input type="datetime-local" value={v.closedAt} onChange={(e) => set("closedAt", e.target.value)} aria-invalid={!!errors.closedAt} />
            </Field>
            <p className="self-end pb-2 text-xs text-muted">{timeZone}</p>
            <Field label={`${t.trade.riskAmount} (${cur}) *`} error={errors.risk} hint={t.trade.riskHint}>
              <Input value={v.risk} onChange={(e) => set("risk", e.target.value)} inputMode="decimal" placeholder="100" aria-invalid={!!errors.risk} />
            </Field>
            <Field label={`${t.trade.result} (${cur}) *`} error={errors.result} hint={t.trade.resultHint}>
              <Input value={v.result} onChange={(e) => set("result", e.target.value)} inputMode="decimal" placeholder="250 / -100" aria-invalid={!!errors.result} />
            </Field>
            <Field label={t.trade.plannedRR} error={errors.plannedRR} hint={t.trade.plannedRRHint}>
              <Input value={v.plannedRR} onChange={(e) => set("plannedRR", e.target.value)} inputMode="decimal" placeholder="2" aria-invalid={!!errors.plannedRR} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.trade.psychology}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-fg-2">{t.trade.emotion}</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.trade.emotion}>
                {EMOTIONS.map((k) => (
                  <button key={k} type="button" aria-pressed={emotionValue === k} onClick={() => set("emotion", emotionValue === k ? "" : k)}
                    className={cn("rounded-full border px-3 py-1 text-xs transition-colors", emotionValue === k ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-fg-2 hover:text-fg")}>
                    {t.emotions[k]}
                  </button>
                ))}
              </div>
            </div>
            <Field label={t.trade.psychology} error={errors.psychology}>
              <Textarea value={v.psychology} onChange={(e) => set("psychology", e.target.value)} placeholder={t.trade.psychologyPlaceholder} />
            </Field>
            <Field label={t.trade.notes} error={errors.notes}>
              <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t.trade.notesPlaceholder} className="min-h-[120px]" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.trade.screenshots}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label={t.trade.tradingview} error={errors.tradingviewUrl} hint={t.trade.tradingviewHint}>
              <div className="flex gap-2">
                <Input value={v.tradingviewUrl} onChange={(e) => set("tradingviewUrl", e.target.value.trim())} placeholder="https://www.tradingview.com/x/…" inputMode="url" aria-invalid={!!errors.tradingviewUrl} />
                {v.tradingviewUrl.startsWith("https://") && <Button asChild variant="ghost" size="icon" aria-label={t.trade.openTradingview}><a href={v.tradingviewUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /></a></Button>}
              </div>
            </Field>
            {v.id ? (
              <ScreenshotGallery userId={userId} tradeId={v.id} shots={screenshots} />
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}><ImagePlus />{t.trade.addScreenshots}</Button>
                  <input ref={fileInput} type="file" accept={SCREENSHOT_TYPES.join(",")} multiple hidden data-testid="screenshot-input"
                    onChange={(e) => {
                      // Read the FileList now: the state updater runs later, after the input is cleared.
                      const picked = acceptFiles(Array.from(e.target.files ?? []), t);
                      setFiles((p) => [...p, ...picked]);
                      e.target.value = "";
                    }} />
                  <span className="text-xs text-muted">{t.trade.screenshotRules}</span>
                </div>
                {files.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {files.map((file, i) => (
                      <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-line bg-elevated px-2.5 py-1 text-xs text-fg-2">
                        {file.name}
                        <button type="button" aria-label={t.common.delete} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-muted hover:text-loss"><X className="size-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader><CardTitle>{t.trade.preview}</CardTitle>{preview && <Badge tone={preview.outcome === "win" ? "profit" : preview.outcome === "loss" ? "loss" : "neutral"}>{t.common[preview.outcome]}</Badge>}</CardHeader>
          <CardContent className="space-y-2.5 text-sm" data-testid="trade-preview">
            {!preview ? <p className="text-muted">{t.trade.previewEmpty}</p> : (
              <>
                <Row label={t.trade.result} value={<span className={toneClass[tone(preview.netPnl)]}>{f.money(preview.netPnl, cur, { sign: true })}</span>} big />
                <Row label={t.trade.rMultiple} value={<span className={toneClass[tone(preview.rMultiple)]}>{f.r(preview.rMultiple)}</span>} />
                <Row label={t.trade.risk} value={f.money(preview.initialRisk, cur)} />
                <Row label={t.trade.rr} value={f.rr(preview.plannedRR)} />
                <Row label={t.trade.duration} value={f.duration(preview.holdingSeconds)} />
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2">
          <Button type="submit" variant="primary" size="lg" disabled={pending}><Save />{pending ? t.common.saving : v.id ? t.trade.saveChanges : t.trade.save}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>{t.common.cancel}</Button>
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
