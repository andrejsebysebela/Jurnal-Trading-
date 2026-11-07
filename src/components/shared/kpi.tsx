import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * KPI tile. The value scales with the tile width (CSS container query units) and never overflows;
 * `title` carries the exact value when the displayed one is abbreviated.
 */
export function Kpi({ label, value, sub, tone = "neutral", hint, className, testId, title }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "profit" | "loss" | "neutral" | "gold"; hint?: string; className?: string; testId?: string; title?: string;
}) {
  return (
    <div className={cn("@container min-w-0 rounded-[var(--radius-card)] border border-line/70 bg-card px-4 py-3.5", className)} data-testid={testId}>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        <span className="truncate" title={label}>{label}</span>
        {hint && <span title={hint} className="shrink-0 cursor-help"><Info className="size-3" /></span>}
      </div>
      <div
        title={title}
        className={cn(
          "num mt-1.5 truncate font-semibold leading-tight tracking-tight",
          "text-[clamp(1rem,13cqi,1.375rem)]",
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "gold" ? "text-gold" : "text-fg",
        )}
      >
        {value}
      </div>
      {sub && <div className="num mt-0.5 truncate text-xs text-fg-2" title={typeof sub === "string" ? sub : undefined}>{sub}</div>}
    </div>
  );
}
