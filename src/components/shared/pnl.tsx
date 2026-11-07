"use client";
import { useI18n } from "@/lib/i18n/client";
import { tone, toneClass } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Signed, coloured money value. Polarity is shown by sign AND colour (colour alone fails CVD). */
export function Pnl({ value, currency, className, sign = true, compact }: { value: string | null | undefined; currency: string; className?: string; sign?: boolean; compact?: boolean }) {
  const { t, f } = useI18n();
  if (value === null || value === undefined) return <span className={cn("text-muted", className)}>{t.common.unavailable}</span>;
  return <span className={cn("num", toneClass[tone(value)], className)}>{f.money(value, currency, { sign, compact })}</span>;
}
