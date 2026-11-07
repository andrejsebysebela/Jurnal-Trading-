"use client";

export interface TipRow { label: string; value: string; tone?: "profit" | "loss" | "neutral" }

export function ChartTooltip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-line bg-elevated px-3 py-2 shadow-xl shadow-black/40">
      <p className="mb-1 text-[11px] font-medium text-fg-2">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted">{r.label}</span>
          <span className={`num font-semibold ${r.tone === "profit" ? "text-profit" : r.tone === "loss" ? "text-loss" : "text-fg"}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
