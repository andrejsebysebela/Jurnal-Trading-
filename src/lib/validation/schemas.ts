import { z } from "zod";
import { ASSET_CLASSES } from "@/lib/engine";

const DEC = /^-?(\d+\.?\d*|\.\d+)$/;
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);

/** Decimal string (never a JS number) — keeps financial inputs exact. */
export const decimal = z.preprocess(emptyToNull, z.string().regex(DEC, "Enter a valid number"));
export const positiveDecimal = decimal.refine((v) => !v.startsWith("-") && !/^0*\.?0*$/.test(v), "Must be greater than zero");
export const nonNegDecimal = decimal.refine((v) => !v.startsWith("-"), "Cannot be negative");
export const optionalDecimal = z.preprocess(emptyToNull, z.string().regex(DEC, "Enter a valid number").nullable()).optional();
export const optionalNonNeg = z.preprocess(emptyToNull, z.string().regex(/^(\d+\.?\d*|\.\d+)$/, "Must be a non-negative number").nullable()).optional();
export const optionalPositive = optionalNonNeg.refine((v) => v == null || !/^0*\.?0*$/.test(v), "Must be greater than zero");
const optionalText = (max = 5000) => z.preprocess(emptyToNull, z.string().max(max).nullable()).optional();
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable()).optional();
const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(min).max(max).nullable()).optional();

/** "YYYY-MM-DDTHH:mm[:ss]" in the user's timezone (datetime-local input). */
export const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/, "Enter a valid date and time");

export const executionSchema = z.object({
  side: z.enum(["buy", "sell"]),
  quantity: positiveDecimal,
  price: nonNegDecimal,
  executedAt: localDateTime,
  fee: optionalNonNeg,
  commission: optionalNonNeg,
});

export const symbolSchema = z
  .string()
  .trim()
  .min(1, "Symbol is required")
  .max(32)
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z0-9._/:!-]+$/.test(s), "Use letters, digits and . _ / : ! - only");

export const tradeFormSchema = z.object({
  id: optionalUuid,
  accountId: z.string().uuid("Select an account"),
  symbol: symbolSchema,
  assetClass: z.enum(ASSET_CLASSES),
  direction: z.enum(["long", "short"]),
  quoteCurrency: z.preprocess(emptyToNull, z.string().regex(/^[A-Z]{3}$/, "3-letter currency code").nullable()).optional(),
  executions: z.array(executionSchema).min(1, "Add at least one execution").max(200),
  stopLoss: optionalNonNeg,
  takeProfit: optionalNonNeg,
  manualInitialRisk: optionalPositive,
  swap: optionalDecimal,
  strategyId: optionalUuid,
  setup: optionalText(120),
  session: optionalText(40),
  timeframe: optionalText(20),
  tags: z.array(z.string().trim().min(1).max(48)).max(30).default([]),
  mistakes: z.array(z.string().trim().min(1).max(48)).max(30).default([]),
  emotionalState: optionalText(48),
  rating: optionalInt(1, 5),
  confidence: optionalInt(1, 10),
  disciplineRating: optionalInt(1, 10),
  ruleCompliant: z.boolean().nullable().optional(),
  checklistState: z.record(z.string(), z.boolean()).optional(),
  noteEntryReason: optionalText(),
  noteExpectation: optionalText(),
  noteExitReason: optionalText(),
  noteDidWell: optionalText(),
  noteDidWrong: optionalText(),
  noteLesson: optionalText(),
  notes: optionalText(20000),
  isDraft: z.boolean().default(false),
});
export type TradeFormInput = z.input<typeof tradeFormSchema>;
export type TradeFormData = z.output<typeof tradeFormSchema>;

export const accountSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, "Name is required").max(80),
  broker: optionalText(80),
  accountType: z.enum(["live", "demo", "prop", "paper"]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter currency code"),
  startingBalance: optionalNonNeg,
  propFirm: optionalText(80),
  profitTarget: optionalPositive,
  maxDailyLoss: optionalPositive,
  maxTotalDrawdown: optionalPositive,
  drawdownType: z.enum(["static", "trailing"]).default("static"),
  isActive: z.boolean().default(true),
});
export type AccountFormInput = z.input<typeof accountSchema>;

export const instrumentSchema = z.object({
  id: optionalUuid,
  symbol: symbolSchema,
  assetClass: z.enum(ASSET_CLASSES),
  description: optionalText(120),
  pointValue: optionalPositive,
  contractSize: optionalPositive,
  contractMultiplier: optionalPositive,
  tickSize: optionalPositive,
  tickValue: optionalPositive,
  quoteCurrency: z.preprocess(emptyToNull, z.string().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter code").nullable()).optional(),
  baseCurrency: z.preprocess(emptyToNull, z.string().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter code").nullable()).optional(),
  lotStep: optionalPositive,
  minLot: optionalPositive,
}).refine((v) => (v.tickSize == null) === (v.tickValue == null), { message: "Tick size and tick value must be set together", path: ["tickValue"] });
export type InstrumentFormInput = z.input<typeof instrumentSchema>;

export const strategySchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, "Name is required").max(80),
  description: optionalText(2000),
  timeframe: optionalText(20),
  marketConditions: optionalText(2000),
  entryCriteria: optionalText(4000),
  exitCriteria: optionalText(4000),
  riskRules: optionalText(4000),
  checklist: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#C6A15B"),
  isActive: z.boolean().default(true),
});
export type StrategyFormInput = z.input<typeof strategySchema>;

export const journalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preMarketPlan: optionalText(20000),
  postMarketReview: optionalText(20000),
  notes: optionalText(20000),
  emotions: z.array(z.string().trim().min(1).max(48)).max(20).default([]),
  ruleViolations: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  mood: optionalInt(1, 5),
  disciplineScore: optionalInt(0, 100),
});
export type JournalFormInput = z.input<typeof journalSchema>;

export const profileSchema = z.object({
  displayName: optionalText(80),
  timezone: z.string().refine((tz) => { try { Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone"),
  baseCurrency: z.string().toUpperCase().regex(/^[A-Z]{3}$/),
  matchingPolicy: z.enum(["fifo", "lifo"]),
  breakevenTolerance: optionalNonNeg,
  fxMaxStaleDays: z.coerce.number().int().min(0).max(7),
});

export const fxRateSchema = z.object({
  base: z.string().toUpperCase().regex(/^[A-Z]{3}$/),
  quote: z.string().toUpperCase().regex(/^[A-Z]{3}$/),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: positiveDecimal,
}).refine((v) => v.base !== v.quote, { message: "Base and quote must differ", path: ["quote"] });

export function flattenErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
