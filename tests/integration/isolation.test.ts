/**
 * API-level tenant isolation test against a REAL Supabase instance (local or staging — never production).
 * Uses only the public anon key, exactly like a browser/attacker would.
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_ANON_KEY=... pnpm test:integration
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (/supabase\.co/.test(url) && !process.env.ALLOW_REMOTE_INTEGRATION) throw new Error("Refusing to run against a hosted project without ALLOW_REMOTE_INTEGRATION=1");

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function newUser(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = client();
  const email = `iso+${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await sb.auth.signUp({ email, password: "password123!" });
  if (error || !data.user || !data.session) throw new Error(`signup failed (email confirmation must be off locally): ${error?.message}`);
  return { sb, id: data.user.id };
}

describe.skipIf(!key)("tenant isolation via REST & Storage", () => {
  let a: { sb: SupabaseClient; id: string }, b: { sb: SupabaseClient; id: string };
  let accountId: string, tradeId: string, path: string;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
    const acct = await a.sb.from("accounts").insert({ name: "A main", currency: "USD" }).select("id").single();
    expect(acct.error).toBeNull();
    accountId = acct.data!.id;
    const t = await a.sb.rpc("save_trade", {
      p_trade: { account_id: accountId, symbol: "ES", asset_class: "futures", direction: "long", status: "closed", opened_at: "2026-01-02T14:00:00Z", closed_at: "2026-01-02T15:00:00Z", net_pnl: "100", pnl_source: "calculated", entry_quantity: "1", exit_quantity: "1", open_quantity: "0" },
      p_executions: [{ side: "buy", quantity: "1", price: "5000", executed_at: "2026-01-02T14:00:00Z" }, { side: "sell", quantity: "1", price: "5002", executed_at: "2026-01-02T15:00:00Z" }],
      p_tag_ids: null,
    });
    expect(t.error).toBeNull();
    tradeId = t.data as string;
    path = `${a.id}/trade/${crypto.randomUUID()}.png`;
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const up = await a.sb.storage.from("screenshots").upload(path, png, { contentType: "image/png" });
    expect(up.error).toBeNull();
  });

  it("other users cannot read any of A's rows", async () => {
    for (const table of ["accounts", "trades", "executions", "profiles", "instruments", "fx_rates", "daily_journals"]) {
      const { data } = await b.sb.from(table).select("*").limit(50);
      expect((data ?? []).filter((r: Record<string, unknown>) => r.user_id === a.id || r.id === a.id)).toEqual([]);
    }
    const { data } = await b.sb.from("trades").select("id").eq("id", tradeId);
    expect(data).toEqual([]);
  });

  it("other users cannot modify or delete A's data", async () => {
    await b.sb.from("trades").update({ net_pnl: 0 }).eq("id", tradeId);
    await b.sb.from("accounts").delete().eq("id", accountId);
    const { data } = await a.sb.from("trades").select("net_pnl:net_pnl::text").eq("id", tradeId).single();
    expect(Number(data!.net_pnl)).toBe(100);
    const acct = await a.sb.from("accounts").select("id").eq("id", accountId);
    expect(acct.data).toHaveLength(1);
  });

  it("other users cannot attach rows to A's account or forge ownership", async () => {
    const forged = await b.sb.from("accounts").insert({ user_id: a.id, name: "forged", currency: "USD" });
    expect(forged.error).not.toBeNull();
    const cross = await b.sb.from("trades").insert({ account_id: accountId, symbol: "ES", asset_class: "futures", direction: "long", opened_at: new Date().toISOString() });
    expect(cross.error).not.toBeNull();
    const rpc = await b.sb.rpc("save_trade", { p_trade: { id: tradeId, account_id: accountId, symbol: "X", asset_class: "stock", direction: "long", status: "closed", opened_at: new Date().toISOString(), pnl_source: "unavailable" }, p_executions: [{ side: "buy", quantity: "1", price: "1", executed_at: new Date().toISOString() }], p_tag_ids: null });
    expect(rpc.error).not.toBeNull();
  });

  it("screenshots are private to their owner", async () => {
    expect((await a.sb.storage.from("screenshots").download(path)).error).toBeNull();
    expect((await b.sb.storage.from("screenshots").download(path)).data).toBeNull();
    expect((await b.sb.storage.from("screenshots").createSignedUrl(path, 60)).data).toBeNull();
    expect((await b.sb.storage.from("screenshots").list(a.id)).data ?? []).toEqual([]);
    const evil = await b.sb.storage.from("screenshots").upload(`${a.id}/trade/evil.png`, new Uint8Array([1]), { contentType: "image/png" });
    expect(evil.error).not.toBeNull();
    const html = await b.sb.storage.from("screenshots").upload(`${b.id}/trade/x.html`, new Blob(["<script>"]), { contentType: "text/html" });
    expect(html.error).not.toBeNull();
    const anonUrl = await fetch(`${url}/storage/v1/object/public/screenshots/${path}`);
    expect(anonUrl.ok).toBe(false);
    await b.sb.storage.from("screenshots").remove([path]);
    expect((await a.sb.storage.from("screenshots").download(path)).error).toBeNull();
  });

  it("anonymous clients cannot read data or call privileged RPCs", async () => {
    const anon = client();
    const { data } = await anon.from("trades").select("id").limit(1);
    expect(data ?? []).toEqual([]);
    expect((await anon.rpc("check_rate_limit", { p_action: "export", p_max: 1, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await anon.from("rate_limit_events").select("*")).error).not.toBeNull();
  });
});
