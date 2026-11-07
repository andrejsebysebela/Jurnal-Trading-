"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/db/session";
import { EXECUTION_COLUMNS, TRADE_COLUMNS } from "@/lib/db/columns";
import type { TradeWithRelations } from "@/lib/db/types";
import { flattenErrors, tradeFormSchema } from "@/lib/validation/schemas";
import { saveTrade } from "@/server/services/trade-service";
import { fail, type ActionResult } from "./result";

const uuid = z.string().uuid();

export async function saveTradeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = tradeFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", flattenErrors(parsed.error));
  try {
    const ctx = await requireUser();
    const res = await saveTrade(ctx, parsed.data);
    if (!res.ok) return fail(res.error, res.fieldErrors);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: res.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTrades(ids: string[]): Promise<ActionResult> {
  const parsed = z.array(uuid).min(1).max(1000).safeParse(ids);
  if (!parsed.success) return fail("Invalid selection.");
  const { supabase } = await requireUser();
  const { data: shots } = await supabase.from("screenshots").select("storage_path").in("trade_id", parsed.data);
  const { error } = await supabase.from("trades").delete().in("id", parsed.data);
  if (error) return fail(error.message);
  if (shots?.length) await supabase.storage.from("screenshots").remove(shots.map((s) => s.storage_path));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function duplicateTrade(id: string): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(id).success) return fail("Invalid trade.");
  const { supabase } = await requireUser();
  // Numerics selected as text — never round-trip money through JS floats.
  const { data, error } = await supabase.from("trades").select(`${TRADE_COLUMNS},executions(${EXECUTION_COLUMNS})`).eq("id", id).single();
  if (error || !data) return fail("Trade not found.");
  const t = data as unknown as TradeWithRelations;
  const { id: _id, executions, trade_tags, created_at: _c, updated_at: _u, activity_at: _a, screenshots: _s, ...rest } = t;
  const { data: newId, error: e2 } = await supabase.rpc("save_trade", {
    p_trade: { ...rest, is_draft: true },
    p_executions: executions.map((e) => ({ side: e.side, quantity: e.quantity, price: e.price, executed_at: e.executed_at, fee: e.fee, commission: e.commission })),
    p_tag_ids: (trade_tags ?? []).map((x) => x.tag_id),
  });
  if (e2) return fail(e2.message);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: newId as string } };
}

const bulkSchema = z.object({
  ids: z.array(uuid).min(1).max(1000),
  addTags: z.array(z.string().trim().min(1).max(48)).max(20).default([]),
  addMistakes: z.array(z.string().trim().min(1).max(48)).max(20).default([]),
  strategyId: z.string().uuid().nullable().optional(),
  session: z.string().max(40).nullable().optional(),
});

/** Bulk edits limited to non-financial fields (tags, strategy, session) — safe by design. */
export async function bulkUpdateTrades(input: z.input<typeof bulkSchema>): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid bulk edit.");
  const { supabase } = await requireUser();
  const { ids, addTags, addMistakes, strategyId, session } = parsed.data;
  const patch: Record<string, unknown> = {};
  if (strategyId !== undefined) patch.strategy_id = strategyId;
  if (session !== undefined) patch.session = session;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("trades").update(patch).in("id", ids);
    if (error) return fail(error.message);
  }
  const pairs: { name: string; kind: "tag" | "mistake" }[] = [
    ...addTags.map((name) => ({ name, kind: "tag" as const })),
    ...addMistakes.map((name) => ({ name, kind: "mistake" as const })),
  ];
  if (pairs.length) {
    const { data: tags, error } = await supabase.from("tags").upsert(pairs, { onConflict: "user_id,kind,name" }).select("id");
    if (error) return fail(error.message);
    const rows = ids.flatMap((trade_id) => (tags ?? []).map((t) => ({ trade_id, tag_id: t.id })));
    const { error: e2 } = await supabase.from("trade_tags").upsert(rows, { onConflict: "trade_id,tag_id", ignoreDuplicates: true });
    if (e2) return fail(e2.message);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const shotSchema = z.object({
  tradeId: uuid.optional(),
  journalId: uuid.optional(),
  storagePath: z.string().min(10).max(300),
  kind: z.enum(["before", "after", "other"]).default("other"),
  caption: z.string().max(200).optional(),
});

/** Register a screenshot uploaded directly to Storage (path must be inside the user's folder). */
export async function addScreenshot(input: z.input<typeof shotSchema>): Promise<ActionResult> {
  const parsed = shotSchema.safeParse(input);
  if (!parsed.success || !!parsed.data.tradeId === !!parsed.data.journalId) return fail("Invalid screenshot.");
  const { supabase, user } = await requireUser();
  if (!parsed.data.storagePath.startsWith(`${user.id}/`)) return fail("Invalid storage path.");
  const { error } = await supabase.from("screenshots").insert({
    trade_id: parsed.data.tradeId ?? null, journal_id: parsed.data.journalId ?? null,
    storage_path: parsed.data.storagePath, kind: parsed.data.kind, caption: parsed.data.caption ?? null,
  });
  if (error) {
    await supabase.storage.from("screenshots").remove([parsed.data.storagePath]);
    return fail(error.message);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteScreenshot(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid screenshot.");
  const { supabase } = await requireUser();
  const { data } = await supabase.from("screenshots").select("storage_path").eq("id", id).single();
  if (!data) return fail("Screenshot not found.");
  const { error } = await supabase.from("screenshots").delete().eq("id", id);
  if (error) return fail(error.message);
  await supabase.storage.from("screenshots").remove([data.storage_path]);
  revalidatePath("/", "layout");
  return { ok: true };
}
