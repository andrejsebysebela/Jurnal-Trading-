import type { GlobalFilters } from "@/lib/db/filters";
import type { Dictionary } from "./dictionaries";

export function rangeLabel(f: GlobalFilters, t: Dictionary): string {
  if (f.range === "custom") return `${f.from ?? "…"} → ${f.to ?? "…"}`;
  return t.ranges[f.range];
}
