"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Select, Textarea } from "@/components/ui/input";
import { updateTradeField } from "@/server/actions/management";

type Field = Parameters<typeof updateTradeField>[0]["field"];

/** Autosaving journal text field (saves on blur). */
export function InlineText({ tradeId, field, label, value }: { tradeId: string; field: Field; label: string; value: string | null }) {
  const [v, setV] = useState(value ?? "");
  const [saved, setSaved] = useState(value ?? "");
  const [pending, start] = useTransition();
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-fg-2">{label}{pending && <span className="text-muted">Saving…</span>}</span>
      <Textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v === saved) return;
          start(async () => { const r = await updateTradeField({ id: tradeId, field, value: v }); if (r.ok) setSaved(v); else toast.error(r.error); });
        }}
        placeholder="Write your thoughts…"
      />
    </label>
  );
}

export function InlineSelect({ tradeId, field, label, value, options }: { tradeId: string; field: Field; label: string; value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-2">{label}</span>
      <Select
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          const raw = e.target.value;
          const val = raw === "" ? null : field === "rule_compliant" ? raw === "yes" : ["confidence", "discipline_rating", "rating"].includes(field) ? Number(raw) : raw;
          start(async () => { const r = await updateTradeField({ id: tradeId, field, value: val }); if (r.ok) router.refresh(); else toast.error(r.error); });
        }}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </label>
  );
}
