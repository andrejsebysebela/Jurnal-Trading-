import { AlertTriangle } from "lucide-react";

export function ScopeNote({ excluded, currency, unavailable }: { excluded: { name: string; currency: string }[]; currency: string; unavailable?: number }) {
  if (!excluded.length && !unavailable) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-sm text-fg-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
      <div className="space-y-0.5">
        {excluded.length > 0 && (
          <p>Showing {currency} accounts only. Excluded (different currency): {excluded.map((a) => `${a.name} (${a.currency})`).join(", ")}. Select an account to view it.</p>
        )}
        {!!unavailable && <p>{unavailable} closed trade{unavailable > 1 ? "s have" : " has"} no P&amp;L yet (missing instrument specification or FX rate) and {unavailable > 1 ? "are" : "is"} excluded from money metrics.</p>}
      </div>
    </div>
  );
}
