import "server-only";
import type { UserContext } from "./session";

/** Distinct pairs the user has traded (for the pair autocomplete). */
export async function listTradedSymbols(sb: UserContext["supabase"]): Promise<string[]> {
  const { data } = await sb.from("trades").select("symbol").order("activity_at", { ascending: false }).limit(1000);
  return [...new Set((data ?? []).map((r) => r.symbol as string))].slice(0, 200);
}
