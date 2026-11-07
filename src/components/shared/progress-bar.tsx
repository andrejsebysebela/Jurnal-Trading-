import { cn } from "@/lib/utils/cn";

export function ProgressBar({ value, tone = "gold", label }: { value: number | null; tone?: "gold" | "profit" | "loss" | "warn"; label?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
      <div className={cn("h-full rounded-full", tone === "profit" ? "bg-profit" : tone === "loss" ? "bg-loss" : tone === "warn" ? "bg-amber-400" : "bg-gold")} style={{ width: `${v}%` }} />
    </div>
  );
}
