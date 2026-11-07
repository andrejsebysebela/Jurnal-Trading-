"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSET_CLASSES } from "@/lib/engine";
import { DATE_FORMATS } from "@/lib/import";
import { requireUser } from "@/lib/db/session";
import { importCsv, type ImportSummary } from "@/server/services/import-service";
import { fail, type ActionResult } from "./result";

const schema = z.object({
  accountId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  csv: z.string().min(1).max(15_000_000),
  mapping: z.object({
    kind: z.enum(["executions", "trades"]),
    columns: z.record(z.string(), z.string()),
    dateFormat: z.enum(DATE_FORMATS.map((d) => d.id) as [string, ...string[]]),
    timeZone: z.string().refine((tz) => { try { Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } }),
    decimalSeparator: z.enum([".", ","]),
    profitIsNet: z.boolean(),
  }),
  symbols: z.array(z.object({ symbol: z.string().min(1).max(32), assetClass: z.enum(ASSET_CLASSES), quoteCurrency: z.string().regex(/^[A-Z]{3}$/).nullable() })).max(2000),
  saveMappingAs: z.string().trim().max(80).optional(),
});

export async function runImport(input: z.input<typeof schema>): Promise<ActionResult<ImportSummary>> {
  const p = schema.safeParse(input);
  if (!p.success) return fail(`Invalid import: ${p.error.issues[0]?.path.join(".")} ${p.error.issues[0]?.message}`);
  try {
    const ctx = await requireUser();
    const mapping = p.data.mapping as Parameters<typeof importCsv>[1]["mapping"];
    if (p.data.saveMappingAs) {
      await ctx.supabase.from("import_mappings").upsert({ name: p.data.saveMappingAs, mapping }, { onConflict: "user_id,name" });
    }
    const summary = await importCsv(ctx, { ...p.data, mapping });
    revalidatePath("/", "layout");
    return { ok: true, data: summary };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteImportBatch(id: string): Promise<ActionResult<{ deleted: number }>> {
  if (!z.string().uuid().safeParse(id).success) return fail("Invalid import.");
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("trades").delete().eq("import_batch_id", id).select("id");
  if (error) return fail(error.message);
  await supabase.from("import_batches").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true, data: { deleted: data?.length ?? 0 } };
}
