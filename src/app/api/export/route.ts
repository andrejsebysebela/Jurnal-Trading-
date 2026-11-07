import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_COLUMNS, EXECUTION_COLUMNS, INSTRUMENT_COLUMNS, TRADE_COLUMNS } from "@/lib/db/columns";

/** Full data export of the signed-in user's journal (RLS-scoped). */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed, error: rlError } = await sb.rpc("check_rate_limit", { p_action: "export", p_max: 10, p_window_seconds: 3600 });
  if (rlError || allowed !== true) return NextResponse.json({ error: "Too many exports. Try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
  const all = async (table: string, cols: string) => {
    const out: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  try {
  const body = {
    exportedAt: new Date().toISOString(),
    format: "edgelog-export-v1",
    accounts: await all("accounts", ACCOUNT_COLUMNS),
    instruments: await all("instruments", INSTRUMENT_COLUMNS),
    strategies: await all("strategies", "*"),
    trades: await all("trades", `${TRADE_COLUMNS},executions(${EXECUTION_COLUMNS})`),
    journals: await all("daily_journals", "*"),
    rules: await all("trading_rules", "*"),
    fxRates: await all("fx_rates", "base,quote,rate_date,source,rate:rate::text"),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="edgelog-export-${body.exportedAt.slice(0, 10)}.json"` },
  });
  } catch (e) {
    console.error("[export]", e);
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
