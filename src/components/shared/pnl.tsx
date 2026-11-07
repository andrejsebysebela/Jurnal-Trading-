import { money, tone, toneClass } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function Pnl({ value, currency, className, sign = true, unavailableLabel = "—" }: { value: string | null | undefined; currency: string; className?: string; sign?: boolean; unavailableLabel?: string }) {
  if (value === null || value === undefined) return <span className={cn("text-muted", className)} title="Unavailable — missing instrument spec or FX rate">{unavailableLabel}</span>;
  return <span className={cn("num", toneClass[tone(value)], className)}>{money(value, currency, { sign })}</span>;
}
