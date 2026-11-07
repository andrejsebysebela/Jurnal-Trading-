"use client";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TradingRule } from "@/lib/db/types";
import { deleteRule, saveRule } from "@/server/actions/management";

export function RulesManager({ rules }: { rules: TradingRule[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error ?? "Error"); else router.refresh(); });
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; run(async () => { const r = await saveRule({ text, category: category || "general" }); if (r.ok) { setText(""); } return r; }); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. No trading in the first 5 minutes" className="min-w-60 flex-1" aria-label="New rule" />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-36" aria-label="Rule category" />
        <Button type="submit" variant="primary" disabled={pending}><Plus />Add rule</Button>
      </form>
      {!rules.length && <p className="text-sm text-muted">No rules yet. Rules power the daily checklist in the Progress Tracker and journal.</p>}
      <ul className="divide-y divide-line/60">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <input type="checkbox" aria-label="Active" className="accent-[#C6A15B]" checked={r.is_active} onChange={(e) => run(() => saveRule({ id: r.id, text: r.text, category: r.category, isActive: e.target.checked }))} />
            <span className={r.is_active ? "flex-1 text-fg" : "flex-1 text-muted line-through"}>{r.text}</span>
            <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">{r.category}</span>
            <button aria-label={`Delete rule ${r.text}`} className="text-muted hover:text-loss" onClick={() => run(() => deleteRule(r.id))}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
