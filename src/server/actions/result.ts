export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Internal DB/driver wording that must never reach the browser. */
const INTERNAL = /(violates|constraint|relation\s|column\s|syntax|permission denied|row-level security|duplicate key|function\s.*does not exist|pgrst|jwt|null value in|invalid input syntax|deadlock|timeout|ECONN|fetch failed)/i;

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Build a client-safe failure. Messages that look like database/driver internals
 * are replaced by a generic message and logged server-side.
 */
export function fail(error: unknown, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw || INTERNAL.test(raw)) {
    if (raw) console.error("[action error]", raw);
    else if (error) console.error("[action error]", error);
    return { ok: false, error: GENERIC_ERROR, fieldErrors };
  }
  return { ok: false, error: raw, fieldErrors };
}
