"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function YearSelect({ years, value }: { years: number[]; value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (years.length <= 1) return <span className="text-xs text-muted">{value}</span>;
  return (
    <select
      aria-label="Year"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.set("year", e.target.value);
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }}
      className="rounded-md border border-line bg-elevated px-2 py-1 text-xs text-fg"
    >
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}
