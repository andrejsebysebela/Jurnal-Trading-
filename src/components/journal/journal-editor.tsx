"use client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { JOURNAL_EMOTIONS } from "@/lib/constants";
import type { DailyJournal } from "@/lib/db/types";
import { cn } from "@/lib/utils/cn";
import { saveJournal } from "@/server/actions/management";

export function JournalEditor({ date, journal, rules }: { date: string; journal: DailyJournal | null; rules: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    preMarketPlan: journal?.pre_market_plan ?? "",
    postMarketReview: journal?.post_market_review ?? "",
    notes: journal?.notes ?? "",
    emotions: journal?.emotions ?? [],
    ruleViolations: journal?.rule_violations ?? [],
    mood: journal?.mood ? String(journal.mood) : "",
    disciplineScore: journal?.discipline_score != null ? String(journal.discipline_score) : "",
  });
  const [custom, setCustom] = useState("");
  const toggle = (key: "emotions" | "ruleViolations", item: string) =>
    setV((p) => ({ ...p, [key]: p[key].includes(item) ? p[key].filter((x) => x !== item) : [...p[key], item] }));

  const save = () => start(async () => {
    const extra = custom.split(",").map((s) => s.trim()).filter(Boolean);
    const r = await saveJournal({ date, ...v, ruleViolations: [...new Set([...v.ruleViolations, ...extra])] });
    if (!r.ok) { toast.error(r.error); return; }
    setCustom("");
    toast.success("Journal saved");
    router.refresh();
  });

  const allRules = [...new Set([...rules, ...v.ruleViolations])];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Pre-market plan"><Textarea value={v.preMarketPlan} onChange={(e) => setV({ ...v, preMarketPlan: e.target.value })} placeholder="Bias, key levels, news, max risk for the day…" className="min-h-[120px]" /></Field>
        <Field label="Post-market review"><Textarea value={v.postMarketReview} onChange={(e) => setV({ ...v, postMarketReview: e.target.value })} placeholder="What happened, what you'd repeat, what you'd change…" className="min-h-[120px]" /></Field>
      </div>
      <Field label="Notes"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      <div>
        <p className="mb-2 text-xs font-medium text-fg-2">Emotions</p>
        <div className="flex flex-wrap gap-1.5">
          {JOURNAL_EMOTIONS.map((e) => (
            <button key={e} type="button" onClick={() => toggle("emotions", e)} aria-pressed={v.emotions.includes(e)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", v.emotions.includes(e) ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-fg-2 hover:text-fg")}>{e}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-fg-2">Rule violations</p>
        {allRules.length > 0 && (
          <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
            {allRules.map((r) => (
              <label key={r} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", v.ruleViolations.includes(r) ? "border-loss/40 bg-loss/[0.06] text-fg" : "border-line text-fg-2")}>
                <input type="checkbox" className="accent-[#E45D67]" checked={v.ruleViolations.includes(r)} onChange={() => toggle("ruleViolations", r)} />{r}
              </label>
            ))}
          </div>
        )}
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Other violations (comma separated)" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:w-1/2">
        <Field label="Mood"><Select value={v.mood} onChange={(e) => setV({ ...v, mood: e.target.value })}><option value="">—</option>{["Very bad", "Bad", "Neutral", "Good", "Great"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Field>
        <Field label="Discipline score (0–100)"><Input type="number" min={0} max={100} value={v.disciplineScore} onChange={(e) => setV({ ...v, disciplineScore: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end"><Button variant="primary" onClick={save} disabled={pending}><Save />{pending ? "Saving…" : "Save journal"}</Button></div>
    </div>
  );
}
