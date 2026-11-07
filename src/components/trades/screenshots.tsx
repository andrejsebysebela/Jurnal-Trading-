"use client";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Screenshot } from "@/lib/db/types";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { addScreenshot, deleteScreenshot } from "@/server/actions/trades";

export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const SCREENSHOT_MAX = 10 * 1024 * 1024;

/** Validate files before upload; returns the accepted ones and toasts the rest. */
export function acceptFiles(files: File[], t: ReturnType<typeof useI18n>["t"]): File[] {
  return files.filter((f) => {
    const ok = SCREENSHOT_TYPES.includes(f.type) && f.size <= SCREENSHOT_MAX;
    if (!ok) toast.error(`${f.name}: ${t.trade.screenshotRules}`);
    return ok;
  });
}

/** Upload straight to the private bucket (path inside the user's folder), then register the row. */
export async function uploadScreenshots(userId: string, tradeId: string, files: File[]): Promise<number> {
  const sb = createClient();
  let ok = 0;
  for (const file of files) {
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${userId}/trade/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("screenshots").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { toast.error(error.message); continue; }
    const r = await addScreenshot({ tradeId, storagePath: path, kind: "other" });
    if (r.ok) ok++; else toast.error(r.error);
  }
  return ok;
}

export function ScreenshotGallery({ userId, tradeId, shots, editable = true }: { userId: string; tradeId: string; shots: Screenshot[]; editable?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Screenshot | null>(null);

  const onFiles = async (list: FileList | null) => {
    const files = acceptFiles(Array.from(list ?? []), t);
    if (!files.length) return;
    setBusy(true);
    await uploadScreenshots(userId, tradeId, files);
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy}><ImagePlus />{busy ? t.trade.uploading : t.trade.addScreenshots}</Button>
          <input ref={input} type="file" accept={SCREENSHOT_TYPES.join(",")} multiple hidden onChange={(e) => onFiles(e.target.files)} data-testid="screenshot-input" />
          <span className="text-xs text-muted">{t.trade.screenshotRules}</span>
        </div>
      )}
      {!shots.length && <p className="text-sm text-muted">{t.trade.noScreenshots}</p>}
      {shots.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {shots.map((s) => (
            <figure key={s.id} className="group relative overflow-hidden rounded-lg border border-line bg-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={t.trade.screenshots} className="aspect-video w-full cursor-zoom-in object-cover" onClick={() => setPreview(s)} />
              {editable && (
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-fg-2 opacity-0 transition-opacity hover:text-loss focus:opacity-100 group-hover:opacity-100"
                  aria-label={t.trade.deleteScreenshot} disabled={pending}
                  onClick={() => { if (confirm(t.trade.deleteScreenshotConfirm)) start(async () => { const r = await deleteScreenshot(s.id); if (r.ok) router.refresh(); else toast.error(r.error); }); }}
                ><Trash2 className="size-4" /></button>
              )}
            </figure>
          ))}
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" onClick={() => setPreview(null)} role="dialog" aria-label={t.trade.screenshots}>
          <button className="absolute right-4 top-4 rounded-md p-2 text-fg-2 hover:text-fg" aria-label={t.common.close}><X className="size-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
