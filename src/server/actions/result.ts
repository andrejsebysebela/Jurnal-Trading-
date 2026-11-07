export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: unknown, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong.";
  return { ok: false, error: message, fieldErrors };
}
