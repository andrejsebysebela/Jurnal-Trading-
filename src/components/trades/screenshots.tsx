"use client";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { Screenshot } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/client";
import { addScreenshot, deleteScreenshot } from "@/server/actions/trades";

const MAX = 10 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function Screenshots({ userId, tradeId, journalId, shots }: { userId: string; tradeId?: string; journalId?: string; shots: Screenshot[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"before" | "after" | "other">("before");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Screenshot | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const sb = createClient();
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) { toast.error(`${file.name}: only PNG, JPEG, WebP or GIF`); continue; }
      if (file.size > MAX) { toast.error(`${file.name}: larger than 10 MB`); continue; }
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${userId}/${tradeId ? "trade" : "journal"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("screenshots").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { toast.error(error.message); continue; }
      const r = await addScreenshot({ tradeId, journalId, storagePath: path, kind: tradeId ? kind : "other" });
      if (!r.ok) toast.error(r.error);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const groups = tradeId ? (["before", "after", "other"] as const) : (["other"] as const);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tradeId && (
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-40" aria-label="Screenshot type">
            <option value="before">Before trade</option><option value="after">After trade</option><option value="other">Additional</option>
          </Select>
        )}
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}><ImagePlus />{busy ? "Uploading…" : "Upload screenshots"}</Button>
        <input ref={input} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => upload(e.target.files)} data-testid="screenshot-input" />
        <span className="text-xs text-muted">PNG, JPEG, WebP, GIF · max 10 MB · stored privately</span>
      </div>
      {!shots.length && <p className="text-sm text-muted">No screenshots yet.</p>}
      {groups.map((g) => {
        const list = shots.filter((s) => s.kind === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            {tradeId && <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{g === "before" ? "Before" : g === "after" ? "After" : "Additional"}</p>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {list.map((s) => (
                <figure key={s.id} className="group relative overflow-hidden rounded-lg border border-line bg-elevated">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.caption ?? `${s.kind} screenshot`} className="aspect-video w-full cursor-zoom-in object-cover" onClick={() => setPreview(s)} />
                  <button
                    className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-fg-2 opacity-0 transition-opacity hover:text-loss group-hover:opacity-100 focus:opacity-100"
                    aria-label="Delete screenshot" disabled={pending}
                    onClick={() => { if (confirm("Delete this screenshot?")) start(async () => { const r = await deleteScreenshot(s.id); if (r.ok) router.refresh(); else toast.error(r.error); }); }}
                  ><Trash2 className="size-4" /></button>
                </figure>
              ))}
            </div>
          </div>
        );
      })}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" onClick={() => setPreview(null)} role="dialog" aria-label="Screenshot preview">
          <button className="absolute right-4 top-4 rounded-md p-2 text-fg-2 hover:text-fg" aria-label="Close preview"><X className="size-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
