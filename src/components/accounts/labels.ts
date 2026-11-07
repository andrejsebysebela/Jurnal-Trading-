import type { Account } from "@/lib/db/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type AccountKind = "prop" | "personal";
export type AccountPhase = "challenge" | "verification" | "funded" | "live" | "demo";

/** Map the stored account_type/prop_phase to the simplified kind + phase. */
export function accountKind(a: Pick<Account, "account_type">): AccountKind {
  return a.account_type === "prop" ? "prop" : "personal";
}
export function accountPhaseKey(a: Pick<Account, "account_type" | "prop_phase">): AccountPhase {
  if (a.account_type === "prop") return a.prop_phase ?? "challenge";
  return a.account_type === "demo" || a.account_type === "paper" ? "demo" : "live";
}
export function accountPhase(a: Pick<Account, "account_type" | "prop_phase" | "prop_firm">, t: Dictionary): string {
  const kind = accountKind(a) === "prop" ? (a.prop_firm || t.account.prop) : t.account.personal;
  return `${kind} · ${t.account.phase[accountPhaseKey(a)]}`;
}
