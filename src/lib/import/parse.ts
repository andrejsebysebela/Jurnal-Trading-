import Papa from "papaparse";
import { parse as parseDate, isValid } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { parseDec } from "@/lib/engine";

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): CsvTable {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (res.meta.fields ?? []).filter((h) => h !== "");
  return { headers, rows: res.data };
}

export const DATE_FORMATS = [
  { id: "iso", label: "ISO 8601 (2024-03-05T14:30:00Z)" },
  { id: "yyyy-MM-dd HH:mm:ss", label: "2024-03-05 14:30:00" },
  { id: "yyyy.MM.dd HH:mm:ss", label: "2024.03.05 14:30:00" },
  { id: "yyyy.MM.dd HH:mm", label: "2024.03.05 14:30" },
  { id: "MM/dd/yyyy HH:mm:ss", label: "03/05/2024 14:30:00 (US)" },
  { id: "MM/dd/yyyy HH:mm", label: "03/05/2024 14:30 (US)" },
  { id: "MM/dd/yyyy h:mm:ss a", label: "03/05/2024 2:30:00 PM (US)" },
  { id: "dd/MM/yyyy HH:mm:ss", label: "05/03/2024 14:30:00 (EU)" },
  { id: "dd/MM/yyyy HH:mm", label: "05/03/2024 14:30 (EU)" },
  { id: "dd.MM.yyyy HH:mm:ss", label: "05.03.2024 14:30:00" },
  { id: "unix_s", label: "Unix seconds" },
  { id: "unix_ms", label: "Unix milliseconds" },
] as const;
export type DateFormatId = (typeof DATE_FORMATS)[number]["id"];

/** Parse a timestamp written in `timeZone` (IANA) and return ISO UTC, or null. */
export function parseTimestamp(value: string | undefined, format: DateFormatId, timeZone: string): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (format === "unix_s" || format === "unix_ms") {
    const num = Number(v);
    if (!Number.isFinite(num)) return null;
    return new Date(format === "unix_s" ? num * 1000 : num).toISOString();
  }
  if (format === "iso") {
    // Offsets/Z in the string win; otherwise interpret in the selected timezone.
    if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    const local = v.replace(" ", "T");
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(local)) return null;
    const d = fromZonedTime(local, timeZone);
    return isValid(d) ? d.toISOString() : null;
  }
  const parsed = parseDate(v, format, new Date(2000, 0, 1));
  if (!isValid(parsed)) return null;
  return fromZonedTime(parsed, timeZone).toISOString();
}

/**
 * Parse a broker-formatted number into a canonical decimal string.
 * Handles thousands separators, comma decimals, currency symbols and (1.23) negatives.
 */
export function parseNumber(value: string | undefined, decimalSeparator: "." | "," = "."): string | null {
  if (value === undefined || value === null) return null;
  let s = String(value).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[\s$€£¥]|[A-Z]{3}$/g, "");
  if (decimalSeparator === ",") s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (s.startsWith("-")) { negative = !negative; s = s.slice(1); }
  const d = parseDec(s);
  if (!d) return null;
  return (negative ? d.neg() : d).toFixed();
}

/** Deterministic 64-bit FNV-1a fingerprint (hex) for duplicate detection. */
export function fingerprint(parts: (string | null | undefined)[]): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = parts.map((p) => (p ?? "").toString().trim().toUpperCase()).join("|");
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
