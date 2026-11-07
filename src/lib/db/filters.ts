import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, subDays, startOfYear, parseISO, format } from "date-fns";

export const FILTER_COOKIE = "edgelog_filters";

export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "ytd", label: "Year to date" },
  { id: "12m", label: "Last 12 months" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

export interface GlobalFilters {
  range: RangePreset;
  from?: string; // YYYY-MM-DD (custom)
  to?: string;
  accountId: string | "all";
}

export const DEFAULT_FILTERS: GlobalFilters = { range: "all", accountId: "all" };

export function parseFilters(raw: string | undefined): GlobalFilters {
  if (!raw) return DEFAULT_FILTERS;
  try {
    const v = JSON.parse(raw);
    const range = RANGE_PRESETS.some((p) => p.id === v.range) ? v.range : "all";
    const date = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
    const accountId = typeof v.accountId === "string" && /^([0-9a-f-]{36}|all)$/.test(v.accountId) ? v.accountId : "all";
    return { range, from: date(v.from), to: date(v.to), accountId };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export interface ResolvedRange {
  /** Inclusive local dates (user timezone), null = unbounded. */
  fromDate: string | null;
  toDate: string | null;
  /** UTC instants for querying: [fromUtc, toUtcExclusive) */
  fromUtc: string | null;
  toUtc: string | null;
  label: string;
}

export function resolveRange(f: GlobalFilters, timeZone: string, now = new Date()): ResolvedRange {
  const today = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const t = parseISO(today);
  let from: string | null = null;
  let to: string | null = today;
  switch (f.range) {
    case "today": from = today; break;
    case "7d": from = format(subDays(t, 6), "yyyy-MM-dd"); break;
    case "30d": from = format(subDays(t, 29), "yyyy-MM-dd"); break;
    case "90d": from = format(subDays(t, 89), "yyyy-MM-dd"); break;
    case "ytd": from = format(startOfYear(t), "yyyy-MM-dd"); break;
    case "12m": from = format(subDays(t, 364), "yyyy-MM-dd"); break;
    case "custom": from = f.from ?? null; to = f.to ?? null; break;
    case "all": from = null; to = null; break;
  }
  const label =
    f.range === "custom"
      ? `${from ?? "…"} → ${to ?? "…"}`
      : RANGE_PRESETS.find((p) => p.id === f.range)!.label;
  return {
    fromDate: from,
    toDate: to,
    fromUtc: from ? fromZonedTime(`${from}T00:00:00`, timeZone).toISOString() : null,
    toUtc: to ? fromZonedTime(`${format(addDays(parseISO(to), 1), "yyyy-MM-dd")}T00:00:00`, timeZone).toISOString() : null,
    label,
  };
}

/** UTC bounds of a single local day. */
export function dayBounds(date: string, timeZone: string) {
  return {
    fromUtc: fromZonedTime(`${date}T00:00:00`, timeZone).toISOString(),
    toUtc: fromZonedTime(`${format(addDays(parseISO(date), 1), "yyyy-MM-dd")}T00:00:00`, timeZone).toISOString(),
  };
}
