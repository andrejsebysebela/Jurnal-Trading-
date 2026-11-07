"use client";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import type { TradingRule } from "@/lib/db/types";
import { cn } from "@/lib/utils/cn";
import { setRuleCheck } from "@/server/actions/management";

export function RuleChecklist({ rules, date, checks }: { rules: TradingRule[]; date: string; checks: Record<string, boolean> }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [state, setState] = useOptimistic(checks, (s, a: { id: string; v: boolean | null }) => {
    const n = { ...s };
    if (a.v === null) delete n[a.id]; else n[a.id] = a.v;
    return n;
  });
  const set = (id: string, v: boolean | null) => start(async () => {
    setState({ id, v });
    const r = await setRuleCheck({ ruleId: id, date, followed: v });
    if (!r.ok) toast.error(r.error);
    router.refresh();
  });
  if (!rules.length) return <p className="text-sm text-muted">Add trading rules in the Playbook to track them daily.</p>;
  return (
    <ul className="space-y-1.5">
      {rules.map((r) => {
        const v = state[r.id];
        return (
          <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line/60 px-3 py-2 text-sm">
            <span className="flex-1 text-fg-2">{r.text}</span>
            <button aria-label={`Followed: ${r.text}`} aria-pressed={v === true} onClick={() => set(r.id, v === true ? null : true)} className={cn("rounded-md p-1.5", v === true ? "bg-profit/15 text-profit" : "text-muted hover:text-profit")}><Check className="size-4" /></button>
            <button aria-label={`Broken: ${r.text}`} aria-pressed={v === false} onClick={() => set(r.id, v === false ? null : false)} className={cn("rounded-md p-1.5", v === false ? "bg-loss/15 text-loss" : "text-muted hover:text-loss")}><X className="size-4" /></button>
          </li>
        );
      })}
    </ul>
  );
}
