"use client";
import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import type { FxRate, Profile, Tag } from "@/lib/db/types";
import { inputDec, plain } from "@/lib/utils/format";
import { deleteFxRate, deleteTag, recalculateAll, saveFxRate, saveProfile } from "@/server/actions/management";

export function ProfileForm({ profile, timeZones }: { profile: Profile; timeZones: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    displayName: profile.display_name ?? "", timezone: profile.timezone, baseCurrency: profile.base_currency, matchingPolicy: profile.matching_policy,
    breakevenTolerance: inputDec(profile.breakeven_tolerance), fxMaxStaleDays: String(profile.fx_max_stale_days),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form className="grid gap-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveProfile(v);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      setErrors({}); toast.success(r.data.recalculated ? `Saved · ${r.data.recalculated} trades recalculated` : "Settings saved"); router.refresh();
    }); }}>
      <Field label="Display name" error={errors.displayName}><Input value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} /></Field>
      <Field label="Timezone" error={errors.timezone} hint="Used for calendar days, sessions and display">
        <Input list="tz-list" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
        <datalist id="tz-list">{timeZones.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>
      <Field label="Base currency" error={errors.baseCurrency} hint="Used for 'All accounts' views"><Input value={v.baseCurrency} maxLength={3} className="uppercase" onChange={(e) => setV({ ...v, baseCurrency: e.target.value.toUpperCase() })} /></Field>
      <Field label="Lot matching" hint="How partial exits are matched to entries"><Select value={v.matchingPolicy} onChange={(e) => setV({ ...v, matchingPolicy: e.target.value as "fifo" | "lifo" })}><option value="fifo">FIFO (first in, first out)</option><option value="lifo">LIFO (last in, first out)</option></Select></Field>
      <Field label="Breakeven tolerance" error={errors.breakevenTolerance} hint="|Net P&L| at or below this counts as breakeven"><Input value={v.breakevenTolerance} inputMode="decimal" placeholder="0" onChange={(e) => setV({ ...v, breakevenTolerance: e.target.value })} /></Field>
      <Field label="FX rate staleness" hint="Use the latest PRIOR rate up to N days old (weekends). 0 = exact date only.">
        <Select value={v.fxMaxStaleDays} onChange={(e) => setV({ ...v, fxMaxStaleDays: e.target.value })}>{[0, 1, 2, 3, 4, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? "Exact date only" : `Up to ${n} day${n > 1 ? "s" : ""}`}</option>)}</Select>
      </Field>
      <div className="flex justify-end md:col-span-3"><Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button></div>
    </form>
  );
}

export function FxRates({ rates }: { rates: FxRate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ base: "EUR", quote: "USD", rateDate: new Date().toISOString().slice(0, 10), rate: "" });
  return (
    <div className="space-y-4">
      <form className="grid grid-cols-2 gap-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await saveFxRate(v);
        if (!r.ok) { toast.error(Object.values(r.fieldErrors ?? {})[0] ?? r.error); return; }
        toast.success(`Rate saved · ${r.data.recalculated} trades recalculated`); setV({ ...v, rate: "" }); router.refresh();
      }); }}>
        <Field label="Base"><Input value={v.base} maxLength={3} className="uppercase" onChange={(e) => setV({ ...v, base: e.target.value.toUpperCase() })} /></Field>
        <Field label="Quote"><Input value={v.quote} maxLength={3} className="uppercase" onChange={(e) => setV({ ...v, quote: e.target.value.toUpperCase() })} /></Field>
        <Field label="Date"><Input type="date" value={v.rateDate} onChange={(e) => setV({ ...v, rateDate: e.target.value })} /></Field>
        <Field label={`1 ${v.base || "BASE"} = ? ${v.quote || "QUOTE"}`}><Input value={v.rate} inputMode="decimal" onChange={(e) => setV({ ...v, rate: e.target.value })} placeholder="1.0850" /></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" className="w-full" disabled={pending || !v.rate}>{pending ? "Saving…" : "Add rate"}</Button></div>
      </form>
      {!rates.length ? <p className="text-sm text-muted">No FX rates yet. Needed only when an instrument&apos;s currency differs from the account currency.</p> : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-left"><th className="py-2 font-medium">Date</th><th className="font-medium">Pair</th><th className="text-right font-medium">Rate</th><th className="pl-4 font-medium">Source</th><th /></tr></thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="num border-b border-line/50 text-fg-2 last:border-0">
                  <td className="py-1.5">{r.rate_date}</td><td className="text-fg">{r.base}/{r.quote}</td><td className="text-right">{plain(r.rate, 8)}</td><td className="pl-4">{r.source}</td>
                  <td className="text-right"><button aria-label="Delete rate" className="text-muted hover:text-loss" onClick={() => start(async () => { const x = await deleteFxRate(r.id); if (!x.ok) toast.error(x.error); router.refresh(); })}><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const groups = [["tag", "Tags"], ["mistake", "Mistakes"]] as const;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map(([kind, label]) => (
        <div key={kind}>
          <p className="mb-2 text-xs font-medium text-fg-2">{label}</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.filter((t) => t.kind === kind).map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-md border border-line bg-elevated px-2 py-1 text-xs text-fg-2">
                {t.name}
                <button disabled={pending} aria-label={`Delete ${t.name}`} className="text-muted hover:text-loss" onClick={() => { if (confirm(`Remove "${t.name}" from all trades?`)) start(async () => { const r = await deleteTag(t.id); if (!r.ok) toast.error(r.error); router.refresh(); }); }}>×</button>
              </span>
            ))}
            {!tags.some((t) => t.kind === kind) && <span className="text-sm text-muted">None yet — they are created as you tag trades.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecalculateButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
      const r = await recalculateAll();
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`${r.data.updated} trades recalculated${r.data.failed ? `, ${r.data.failed} failed` : ""}`); router.refresh();
    })}><RefreshCw className={pending ? "animate-spin" : ""} />{pending ? "Recalculating…" : "Recalculate all trades"}</Button>
  );
}
