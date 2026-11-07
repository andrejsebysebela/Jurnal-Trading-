import "server-only";
import type { UserContext } from "@/lib/db/session";

export const LIMITS = {
  import: { max: 20, windowSeconds: 3600 },
  export: { max: 10, windowSeconds: 3600 },
  recalculate: { max: 30, windowSeconds: 3600 },
} as const;

/** Returns null when allowed, or a user-facing message when the limit is hit. Fails closed on errors. */
export async function rateLimit(sb: UserContext["supabase"], action: keyof typeof LIMITS): Promise<string | null> {
  const { max, windowSeconds } = LIMITS[action];
  const { data, error } = await sb.rpc("check_rate_limit", { p_action: action, p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[rate-limit]", error.message);
    return "Service is busy. Please try again shortly.";
  }
  return data === true ? null : `Limit reached: at most ${max} ${action} operations per hour. Please try again later.`;
}
