"use client";
import {
  flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type RowSelectionState, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Download, Image as ImageIcon, LineChart, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { EMOTIONS, emotionKey } from "@/lib/constants";
import type { Account } from "@/lib/db/types";
import { useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import { tone, toneClass } from "@/lib/utils/format";
import { deleteTrades } from "@/server/actions/trades";

export interface TradeListRow {
  id: string;
  account_id: string;
  symbol: string;
  direction: "long" | "short";
  opened_at: string;
  closed_at: string | null;
  activity_at: string;
  net_pnl: string | null;
  risk: string | null;
  r_multiple: string | null;
  planned_rr: string | null;
  holding_seconds: number | null;
  outcome: "win" | "loss" | "breakeven" | null;
  emotion: string | null;
  notes: string | null;
  has_screenshots: boolean;
  tradingview_url: string | null;
}

interface Filters { q: string; symbol: string; direction: string; outcome: string; emotion: string }
const EMPTY: Filters = { q: "", symbol: "", direction: "", outcome: "", emotion: "" };
const csvCell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const numSort = (get: (r: TradeListRow) => string | number | null) => (a: { original: TradeListRow }, b: { original: TradeListRow }) => {
  const x = get(a.original), y = get(b.original);
  if (x === null) return y === null ? 0 : -1;
  if (y === null) return 1;
  return Number(x) - Number(y);
};

export function TradesTable({ rows, accounts, timeZone, initialQuery }: { rows: TradeListRow[]; accounts: Account[]; timeZone: string; initialQuery?: string }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [flt, setFlt] = useState<Filters>({ ...EMPTY, q: initialQuery ?? "" });
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const acct = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const symbols = useMemo(() => [...new Set(rows.map((r) => r.symbol))].sort(), [rows]);
  const emo = (k: string | null) => (k ? (t.emotions as Record<string, string>)[k] ?? k : null);

  const data = useMemo(() => {
    const q = flt.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (flt.symbol && r.symbol !== flt.symbol) return false;
      if (flt.direction && r.direction !== flt.direction) return false;
      if (flt.outcome && r.outcome !== flt.outcome) return false;
      if (flt.emotion && emotionKey(r.emotion) !== flt.emotion) return false;
      if (q && ![r.symbol, r.notes, acct.get(r.account_id)?.name, emo(emotionKey(r.emotion))].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, flt, acct]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = (r: TradeListRow) => acct.get(r.account_id)?.currency ?? "USD";
  const c = t.trades.columns;
  const columns = useMemo<ColumnDef<TradeListRow>[]>(() => [
    { id: "select", size: 36, enableSorting: false,
      header: ({ table }) => <input type="checkbox" aria-label={t.trades.selectAll} className="accent-[#C6A15B]" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />,
      cell: ({ row }) => <input type="checkbox" aria-label={t.trades.selectTrade} className="accent-[#C6A15B]" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(e) => e.stopPropagation()} /> },
    { id: "date", header: c.date, accessorFn: (r) => r.activity_at, cell: ({ row }) => <span className="text-fg">{f.date(row.original.activity_at, timeZone, "d MMM yy, HH:mm")}</span> },
    { id: "pair", header: c.pair, accessorKey: "symbol", cell: ({ row }) => <span className="font-medium text-fg">{row.original.symbol}</span> },
    { id: "direction", header: c.direction, accessorKey: "direction", cell: ({ getValue }) => <span className={getValue() === "long" ? "text-profit" : "text-loss"}>{getValue() === "long" ? t.common.long : t.common.short}</span> },
    { id: "account", header: c.account, accessorFn: (r) => acct.get(r.account_id)?.name ?? "" },
    { id: "risk", header: c.risk, accessorFn: (r) => r.risk, sortingFn: numSort((r) => r.risk), cell: ({ row }) => f.money(row.original.risk, cur(row.original)) },
    { id: "result", header: c.result, accessorFn: (r) => r.net_pnl, sortingFn: numSort((r) => r.net_pnl), cell: ({ row }) => (
      row.original.net_pnl === null ? <span className="text-muted">—</span> : <span className={cn("font-semibold", toneClass[tone(row.original.net_pnl)])}>{f.money(row.original.net_pnl, cur(row.original), { sign: true })}</span>
    ) },
    { id: "r", header: c.r, accessorFn: (r) => r.r_multiple, sortingFn: numSort((r) => r.r_multiple), cell: ({ getValue }) => <span className={toneClass[tone(getValue() as string)]}>{f.r(getValue() as string)}</span> },
    { id: "rr", header: c.rr, accessorFn: (r) => r.planned_rr, sortingFn: numSort((r) => r.planned_rr), cell: ({ getValue }) => f.rr(getValue() as string) },
    { id: "duration", header: c.duration, accessorFn: (r) => r.holding_seconds, sortingFn: numSort((r) => r.holding_seconds), cell: ({ getValue }) => f.duration(getValue() as number | null) },
    { id: "emotion", header: c.emotion, accessorFn: (r) => emo(emotionKey(r.emotion)) ?? "", cell: ({ getValue }) => (getValue() ? <Badge>{getValue() as string}</Badge> : <span className="text-muted">—</span>) },
    { id: "media", header: c.media, enableSorting: false, cell: ({ row }) => (
      <span className="flex gap-1.5 text-muted">
        {row.original.has_screenshots && <ImageIcon className="size-4" aria-label={t.trades.hasScreenshot} />}
        {row.original.tradingview_url && <LineChart className="size-4 text-gold" aria-label={t.trades.hasTradingview} />}
      </span>
    ) },
  ], [acct, timeZone, t, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data, columns, getRowId: (r) => r.id,
    state: { sorting, rowSelection: selection },
    onSortingChange: setSorting, onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);
  const active = Object.entries(flt).filter(([k, v]) => v && k !== "q").length;
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setFlt((p) => ({ ...p, [k]: e.target.value }));

  const exportCsv = () => {
    const header = ["open_utc", "close_utc", "account", "pair", "direction", "risk", "result", "currency", "r_multiple", "planned_rr", "duration_s", "emotion", "tradingview_url", "notes"];
    const lines = table.getSortedRowModel().rows.map(({ original: r }) => [
      r.opened_at, r.closed_at, acct.get(r.account_id)?.name, r.symbol, r.direction, r.risk, r.net_pnl, cur(r), r.r_multiple, r.planned_rr,
      r.holding_seconds, emotionKey(r.emotion), r.tradingview_url, r.notes,
    ].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `edgelog-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={flt.q} onChange={set("q")} placeholder={t.trades.searchPlaceholder} className="w-full max-w-xs" aria-label={t.common.search} />
        <Select value={flt.symbol} onChange={set("symbol")} className="w-auto min-w-28" aria-label={t.trades.filterPair}><option value="">{t.trades.filterPair}: {t.common.all}</option>{symbols.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={flt.direction} onChange={set("direction")} className="w-auto min-w-28" aria-label={t.trade.direction}><option value="">{t.trade.direction}: {t.common.all}</option><option value="long">{t.common.long}</option><option value="short">{t.common.short}</option></Select>
        <Select value={flt.outcome} onChange={set("outcome")} className="w-auto min-w-28" aria-label={t.trades.filterResult}><option value="">{t.trades.filterResult}: {t.common.all}</option><option value="win">{t.common.win}</option><option value="loss">{t.common.loss}</option><option value="breakeven">{t.common.breakeven}</option></Select>
        <Select value={flt.emotion} onChange={set("emotion")} className="w-auto min-w-28" aria-label={t.trades.filterEmotion}><option value="">{t.trades.filterEmotion}: {t.common.all}</option>{EMOTIONS.map((k) => <option key={k} value={k}>{t.emotions[k]}</option>)}</Select>
        {active > 0 && <Button variant="ghost" size="sm" onClick={() => setFlt({ ...EMPTY, q: flt.q })}><X />{t.common.clear}</Button>}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">{data.length}</span>
          <Button variant="secondary" onClick={exportCsv} disabled={!data.length}><Download />{t.common.export}</Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-2 text-sm">
          <span className="text-fg">{fill(t.trades.selected, { n: selectedIds.length })}</span>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 />{t.trades.deleteSelected}</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>{t.trades.clearSelection}</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line/70 bg-card">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line">
                {hg.headers.map((h) => (
                  <th key={h.id} className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                    {h.isPlaceholder ? null : !h.column.getCanSort() ? flexRender(h.column.columnDef.header, h.getContext()) : (
                      <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-fg">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" /> : h.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" /> : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} onClick={() => router.push(`/trades/${row.original.id}`)} className={cn("cursor-pointer border-b border-line/50 text-fg-2 transition-colors last:border-0 hover:bg-elevated/60", row.getIsSelected() && "bg-gold/[0.05]")} data-testid="trade-row">
                {row.getVisibleCells().map((cell) => <td key={cell.id} className="num whitespace-nowrap px-3 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
            {!data.length && <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted">{t.trades.noMatch}</td></tr>}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-fg-2">
          <span>{fill(t.common.page, { page: table.getState().pagination.pageIndex + 1, total: table.getPageCount() })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>{t.common.previous}</Button>
            <Button size="sm" variant="secondary" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>{t.common.next}</Button>
          </div>
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={fill(t.trades.bulkDeleteTitle, { n: selectedIds.length })} description={t.trades.bulkDeleteBody}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t.common.cancel}</Button>
            <Button variant="danger" disabled={pending} onClick={() => start(async () => {
              const r = await deleteTrades(selectedIds);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(t.trade.deleted); setSelection({}); setConfirmDelete(false); router.refresh();
            })}>{pending ? t.common.deleting : t.common.delete}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
