import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Kpi({ label, value, sub, tone = "neutral", hint, className, testId }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "profit" | "loss" | "neutral" | "gold"; hint?: string; className?: string; testId?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-line/70 bg-card px-4 py-3.5", className)} data-testid={testId}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
        {hint && <span title={hint} className="cursor-help"><Info className="size-3" /></span>}
      </div>
      <div className={cn("num mt-1.5 text-[22px] font-semibold leading-tight tracking-tight",
        tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "gold" ? "text-gold" : "text-fg")}>{value}</div>
      {sub && <div className="num mt-0.5 text-xs text-fg-2">{sub}</div>}
    </div>
  );
}
