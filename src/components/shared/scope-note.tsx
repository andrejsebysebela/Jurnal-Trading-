"use client";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/config";

export function ScopeNote({ excluded, currency }: { excluded: { name: string; currency: string }[]; currency: string; unavailable?: number }) {
  const { t } = useI18n();
  if (!excluded.length) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-sm text-fg-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
      <p>{fill(t.stats.scopeExcluded, { currency, list: excluded.map((a) => `${a.name} (${a.currency})`).join(", ") })}</p>
    </div>
  );
}
