import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const DEC = /^-?(\d+\.?\d*|\.\d+)$/;
const POS_DEC = /^(\d+\.?\d*|\.\d+)$/;

/** Trim; accept a decimal comma ("12,5") as typed by Slovak users; "" → null. */
const normDec = (v: unknown) => {
  if (typeof v !== "string") return v;
  const s = v.trim().replace(/\s/g, "").replace(",", ".");
  return s === "" ? null : s;
};
const emptyToNull = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v);
const isZero = (v: string) => /^0*\.?0*$/.test(v);

/** "YYYY-MM-DDTHH:mm[:ss]" in the user's timezone (datetime-local input). */
export const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

export function simpleTradeSchema(t: Dictionary) {
  const e = t.trade.errors;
  return z
    .object({
      id: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
      accountId: z.string({ error: e.account }).uuid(e.account),
      symbol: z.string().trim().min(1, e.pair).max(32, e.pair).transform((s) => s.toUpperCase()).refine((s) => /^[A-Z0-9._/:!-]+$/.test(s), e.pair),
      direction: z.enum(["long", "short"]),
      openedAt: z.string().regex(LOCAL_DT, e.date),
      closedAt: z.string().regex(LOCAL_DT, e.date),
      risk: z.preprocess(normDec, z.string({ error: e.risk }).regex(POS_DEC, e.risk).refine((v) => !isZero(v), e.risk)),
      result: z.preprocess(normDec, z.string({ error: e.result }).regex(DEC, e.result)),
      plannedRR: z.preprocess(normDec, z.string().regex(POS_DEC, e.rr).refine((v) => !isZero(v), e.rr).nullable()).optional(),
      emotion: z.preprocess(emptyToNull, z.string().max(48, e.tooLong).nullable()).optional(),
      psychology: z.preprocess(emptyToNull, z.string().max(5000, e.tooLong).nullable()).optional(),
      notes: z.preprocess(emptyToNull, z.string().max(20000, e.tooLong).nullable()).optional(),
      tradingviewUrl: z.preprocess(
        emptyToNull,
        z.string().max(500, e.tooLong).refine((u) => {
          try {
            const url = new URL(u);
            return url.protocol === "https:" && (url.hostname === "tradingview.com" || url.hostname.endsWith(".tradingview.com"));
          } catch {
            return false;
          }
        }, e.tradingview).nullable(),
      ).optional(),
    })
    .refine((v) => v.closedAt >= v.openedAt, { message: e.closeBeforeOpen, path: ["closedAt"] });
}
export type SimpleTradeInput = z.input<ReturnType<typeof simpleTradeSchema>>;
export type SimpleTradeData = z.output<ReturnType<typeof simpleTradeSchema>>;

export function accountSchema(t: Dictionary) {
  const e = t.accounts.errors;
  const optAmount = z.preprocess(normDec, z.string().regex(POS_DEC, e.amount).refine((v) => !isZero(v), e.amount).nullable()).optional();
  return z
    .object({
      id: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
      name: z.string().trim().min(1, e.name).max(80),
      kind: z.enum(["prop", "personal"]),
      phase: z.enum(["challenge", "verification", "funded", "live", "demo"]),
      propFirm: z.preprocess(emptyToNull, z.string().max(80).nullable()).optional(),
      currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, e.currency),
      startingBalance: z.preprocess(normDec, z.string().regex(POS_DEC, e.nonNegative).nullable()).optional(),
      profitTarget: optAmount,
      maxDailyLoss: optAmount,
      maxTotalDrawdown: optAmount,
      drawdownType: z.enum(["static", "trailing"]).default("static"),
      isActive: z.boolean().default(true),
    })
    .transform((v) => ({
      ...v,
      // keep phase consistent with the kind
      phase: v.kind === "prop" ? (["challenge", "verification", "funded"].includes(v.phase) ? v.phase : "challenge") : (v.phase === "demo" ? "demo" : "live"),
    }));
}
export type AccountFormInput = z.input<ReturnType<typeof accountSchema>>;

export function profileSchema(t: Dictionary) {
  return z.object({
    displayName: z.preprocess(emptyToNull, z.string().max(80).nullable()).optional(),
    timezone: z.string().refine((tz) => { try { Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } }, t.settings.unknownTimezone),
    baseCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, t.accounts.errors.currency),
  });
}

export function flattenErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
