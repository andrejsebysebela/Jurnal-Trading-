"use client";
import {
  flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowDown, ArrowUp, Columns3, Copy, Download, Filter, MoreHorizontal, Pencil, Tag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dropdown, DropdownCheckbox, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/input";
import { ASSET_CLASSES } from "@/lib/engine";
import { tradeTagNames } from "@/lib/db/tag-names";
import type { Account, Strategy, TradeRow } from "@/lib/db/types";
import { money, plain, rMultiple, tone, toneClass } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { bulkUpdateTrades, deleteTrades, duplicateTrade } from "@/server/actions/trades";
import { SESSIONS, TIMEFRAMES } from "@/lib/constants";

interface Filters {
  q: string; symbol: string; assetClass: string; direction: string; outcome: string; strategyId: string; session: string; timeframe: string; tag: string; compliance: string; drafts: string;
}
const EMPTY: Filters = { q: "", symbol: "", assetClass: "", direction: "", outcome: "", strategyId: "", session: "", timeframe: "", tag: "", compliance: "", drafts: "exclude" };

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function TradesTable({ rows, accounts, strategies, timeZone, initialQuery, initialPnl }: {
  rows: TradeRow[]; accounts: Account[]; strategies: Strategy[]; timeZone: string; initialQuery?: string; initialPnl?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<Filters>({ ...EMPTY, q: initialQuery ?? "", outcome: initialPnl === "unavailable" ? "unavailable" : "" });
  const [showFilters, setShowFilters] = useState(!!initialPnl);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [visibility, setVisibility] = useState<VisibilityState>({ assetClass: false, takeProfit: false, session: false, account: accounts.length < 2 ? false : true, grossPnl: false, initialRisk: false });
  const [bulkOpen, setBulkOpen] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem("edgelog.tradeCols"); if (v) setVisibility(JSON.parse(v)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("edgelog.tradeCols", JSON.stringify(visibility)); } catch {} }, [visibility]);

  const acct = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const strat = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);
  const symbols = useMemo(() => [...new Set(rows.map((r) => r.symbol))].sort(), [rows]);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => tradeTagNames(r, "tag").concat(tradeTagNames(r, "mistake"))))].sort(), [rows]);

  const data = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (f.drafts === "exclude" && r.is_draft) return false;
      if (f.drafts === "only" && !r.is_draft) return false;
      if (f.symbol && r.symbol !== f.symbol) return false;
      if (f.assetClass && r.asset_class !== f.assetClass) return false;
      if (f.direction && r.direction !== f.direction) return false;
      if (f.outcome === "open" && r.status !== "open") return false;
      if (f.outcome === "unavailable" && !(r.status === "closed" && r.net_pnl === null)) return false;
      if (["win", "loss", "breakeven"].includes(f.outcome) && r.outcome !== f.outcome) return false;
      if (f.strategyId === "none" ? r.strategy_id : f.strategyId && r.strategy_id !== f.strategyId) return false;
      if (f.session && r.session !== f.session) return false;
      if (f.timeframe && r.timeframe !== f.timeframe) return false;
      if (f.tag && !tradeTagNames(r, "tag").concat(tradeTagNames(r, "mistake")).includes(f.tag)) return false;
      if (f.compliance === "yes" && r.rule_compliant !== true) return false;
      if (f.compliance === "no" && r.rule_compliant !== false) return false;
      if (f.compliance === "unreviewed" && r.rule_compliant !== null) return false;
      if (q) {
        const hay = [r.symbol, r.setup, r.session, r.notes, strat.get(r.strategy_id ?? "")?.name, ...tradeTagNames(r, "tag"), ...tradeTagNames(r, "mistake")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, f, strat]);

  const columns = useMemo<ColumnDef<TradeRow>[]>(() => {
    const num = (get: (r: TradeRow) => string | null) => (a: { original: TradeRow }, b: { original: TradeRow }) => {
      const x = get(a.original), y = get(b.original);
      if (x === null) return y === null ? 0 : -1;
      if (y === null) return 1;
      return Number(x) - Number(y);
    };
    const cur = (r: TradeRow) => acct.get(r.account_id)?.currency ?? "USD";
    return [
      { id: "select", size: 36, enableSorting: false, enableHiding: false,
        header: ({ table }) => <input type="checkbox" aria-label="Select all" className="accent-[#C6A15B]" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />,
        cell: ({ row }) => <input type="checkbox" aria-label="Select trade" className="accent-[#C6A15B]" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(e) => e.stopPropagation()} /> },
      { id: "date", header: "Date", accessorFn: (r) => r.activity_at, size: 104, cell: ({ row }) => <span className="text-fg">{formatInTimeZone(row.original.activity_at, timeZone, "MMM d, yy")}</span> },
      { id: "time", header: "Time", accessorFn: (r) => formatInTimeZone(r.opened_at, timeZone, "HH:mm"), size: 64 },
      { id: "account", header: "Account", accessorFn: (r) => acct.get(r.account_id)?.name ?? "", size: 120 },
      { id: "symbol", header: "Instrument", accessorKey: "symbol", size: 110, cell: ({ row }) => (
        <span className="flex items-center gap-1.5 font-medium text-fg">{row.original.symbol}{row.original.is_draft && <Badge>draft</Badge>}{row.original.status === "open" && <Badge tone="gold">open</Badge>}</span>
      ) },
      { id: "assetClass", header: "Class", accessorKey: "asset_class", size: 80 },
      { id: "direction", header: "Side", accessorKey: "direction", size: 70, cell: ({ getValue }) => <span className={getValue() === "long" ? "text-profit" : "text-loss"}>{getValue() === "long" ? "Long" : "Short"}</span> },
      { id: "entry", header: "Entry", accessorFn: (r) => r.avg_entry_price, sortingFn: num((r) => r.avg_entry_price), size: 96, cell: ({ getValue }) => plain(getValue() as string) },
      { id: "exit", header: "Exit", accessorFn: (r) => r.avg_exit_price, sortingFn: num((r) => r.avg_exit_price), size: 96, cell: ({ getValue }) => plain(getValue() as string) },
      { id: "quantity", header: "Qty", accessorFn: (r) => r.entry_quantity, sortingFn: num((r) => r.entry_quantity), size: 70, cell: ({ getValue }) => plain(getValue() as string, 4) },
      { id: "stopLoss", header: "Stop", accessorFn: (r) => r.stop_loss, size: 90, cell: ({ getValue }) => plain(getValue() as string) },
      { id: "takeProfit", header: "Target", accessorFn: (r) => r.take_profit, size: 90, cell: ({ getValue }) => plain(getValue() as string) },
      { id: "grossPnl", header: "Gross", accessorFn: (r) => r.gross_pnl, sortingFn: num((r) => r.gross_pnl), size: 100, cell: ({ row }) => money(row.original.gross_pnl, cur(row.original)) },
      { id: "fees", header: "Fees", accessorFn: (r) => r.fees, sortingFn: num((r) => r.fees), size: 80, cell: ({ row }) => money(row.original.fees, cur(row.original)) },
      { id: "netPnl", header: "Net P&L", accessorFn: (r) => r.net_pnl, sortingFn: num((r) => r.net_pnl), size: 110, cell: ({ row }) => (
        row.original.net_pnl === null
          ? <span className="text-muted" title="Missing instrument specification or FX rate">unavailable</span>
          : <span className={cn("font-semibold", toneClass[tone(row.original.net_pnl)])}>{money(row.original.net_pnl, cur(row.original), { sign: true })}</span>
      ) },
      { id: "initialRisk", header: "Risk", accessorFn: (r) => r.initial_risk, sortingFn: num((r) => r.initial_risk), size: 90, cell: ({ row }) => money(row.original.initial_risk, cur(row.original)) },
      { id: "r", header: "R", accessorFn: (r) => r.r_multiple, sortingFn: num((r) => r.r_multiple), size: 70, cell: ({ getValue }) => <span className={toneClass[tone(getValue() as string)]}>{rMultiple(getValue() as string)}</span> },
      { id: "strategy", header: "Strategy", accessorFn: (r) => strat.get(r.strategy_id ?? "")?.name ?? "", size: 120 },
      { id: "session", header: "Session", accessorFn: (r) => r.session ?? "", size: 100 },
      { id: "tags", header: "Tags", accessorFn: (r) => tradeTagNames(r, "tag").join(", "), enableSorting: false, size: 150, cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">{tradeTagNames(row.original, "tag").slice(0, 3).map((t) => <Badge key={t}>{t}</Badge>)}{tradeTagNames(row.original, "mistake").slice(0, 2).map((t) => <Badge key={t} tone="loss">{t}</Badge>)}</span>
      ) },
      { id: "rating", header: "Rating", accessorFn: (r) => r.rating ?? 0, size: 70, cell: ({ row }) => row.original.rating ? <span className="text-gold">{"★".repeat(row.original.rating)}</span> : <span className="text-muted">—</span> },
      { id: "actions", size: 44, enableSorting: false, enableHiding: false, header: "", cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown>
            <DropdownTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="Trade actions"><MoreHorizontal /></Button></DropdownTrigger>
            <DropdownContent>
              <DropdownItem asChild><Link href={`/trades/${row.original.id}/edit`}><Pencil />Edit</Link></DropdownItem>
              <DropdownItem onSelect={() => start(async () => { const r = await duplicateTrade(row.original.id); if (r.ok) { toast.success("Duplicated as draft"); router.push(`/trades/${r.data.id}/edit`); } else toast.error(r.error); })}><Copy />Duplicate</DropdownItem>
              <DropdownSeparator />
              <DropdownItem danger onSelect={() => { setSelection({ [row.original.id]: true }); setConfirmDelete(true); }}><Trash2 />Delete</DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      ) },
    ];
  }, [acct, strat, timeZone, router]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const table = useReactTable({
    data, columns, getRowId: (r) => r.id,
    state: { sorting, rowSelection: selection, columnVisibility: visibility },
    onSortingChange: setSorting, onRowSelectionChange: setSelection, onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange", enableColumnResizing: true,
    initialState: { pagination: { pageSize: 50 } },
  });
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);
  const activeFilters = Object.entries(f).filter(([k, v]) => v && k !== "q" && !(k === "drafts" && v === "exclude")).length;

  const exportCsv = () => {
    const header = ["date_open_utc", "date_close_utc", "account", "symbol", "asset_class", "direction", "status", "quantity", "avg_entry", "avg_exit", "stop_loss", "take_profit", "gross_pnl", "fees", "net_pnl", "currency", "initial_risk", "r_multiple", "strategy", "session", "timeframe", "tags", "mistakes", "rating"];
    const lines = table.getSortedRowModel().rows.map(({ original: r }) => [
      r.opened_at, r.closed_at, acct.get(r.account_id)?.name, r.symbol, r.asset_class, r.direction, r.status, r.entry_quantity, r.avg_entry_price, r.avg_exit_price,
      r.stop_loss, r.take_profit, r.gross_pnl, r.fees, r.net_pnl, acct.get(r.account_id)?.currency, r.initial_risk, r.r_multiple,
      strat.get(r.strategy_id ?? "")?.name, r.session, r.timeframe, tradeTagNames(r, "tag").join("|"), tradeTagNames(r, "mistake").join("|"), r.rating,
    ].map(csvCell).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `edgelog-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={f.q} onChange={set("q")} placeholder="Search symbol, strategy, tags, notes…" className="max-w-xs" aria-label="Search trades" />
        <Button variant={showFilters ? "outline" : "secondary"} onClick={() => setShowFilters((s) => !s)}><Filter />Filters{activeFilters > 0 && <Badge tone="gold">{activeFilters}</Badge>}</Button>
        {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={() => setF({ ...EMPTY, q: f.q })}><X />Clear</Button>}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">{data.length} trade{data.length === 1 ? "" : "s"}</span>
          <Dropdown>
            <DropdownTrigger asChild><Button variant="secondary"><Columns3 />Columns</Button></DropdownTrigger>
            <DropdownContent className="max-h-80 overflow-y-auto">
              <DropdownLabel>Visible columns</DropdownLabel>
              {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                <DropdownCheckbox key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>{String(c.columnDef.header)}</DropdownCheckbox>
              ))}
            </DropdownContent>
          </Dropdown>
          <Button variant="secondary" onClick={exportCsv} disabled={!data.length}><Download />Export</Button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Instrument"><Select value={f.symbol} onChange={set("symbol")}><option value="">All</option>{symbols.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Asset class"><Select value={f.assetClass} onChange={set("assetClass")}><option value="">All</option>{ASSET_CLASSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
          <Field label="Direction"><Select value={f.direction} onChange={set("direction")}><option value="">All</option><option value="long">Long</option><option value="short">Short</option></Select></Field>
          <Field label="Result"><Select value={f.outcome} onChange={set("outcome")}><option value="">All</option><option value="win">Winning</option><option value="loss">Losing</option><option value="breakeven">Breakeven</option><option value="open">Open</option><option value="unavailable">P&amp;L unavailable</option></Select></Field>
          <Field label="Strategy"><Select value={f.strategyId} onChange={set("strategyId")}><option value="">All</option><option value="none">No strategy</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Session"><Select value={f.session} onChange={set("session")}><option value="">All</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Timeframe"><Select value={f.timeframe} onChange={set("timeframe")}><option value="">All</option>{TIMEFRAMES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Tag / mistake"><Select value={f.tag} onChange={set("tag")}><option value="">All</option>{allTags.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Rule compliance"><Select value={f.compliance} onChange={set("compliance")}><option value="">All</option><option value="yes">Followed</option><option value="no">Broken</option><option value="unreviewed">Not reviewed</option></Select></Field>
          <Field label="Drafts"><Select value={f.drafts} onChange={set("drafts")}><option value="exclude">Hide drafts</option><option value="include">Include drafts</option><option value="only">Drafts only</option></Select></Field>
          <p className="col-span-2 self-end text-xs text-muted sm:col-span-3 lg:col-span-2">Date range and account come from the selectors in the top bar.</p>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-2 text-sm">
          <span className="text-fg">{selectedIds.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}><Tag />Bulk edit</Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>Clear selection</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line/70 bg-card">
        <table className="w-full text-[13px]" style={{ minWidth: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line">
                {hg.headers.map((h) => (
                  <th key={h.id} style={{ width: h.getSize() }} className="relative select-none whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                    {h.isPlaceholder ? null : !h.column.getCanSort() ? flexRender(h.column.columnDef.header, h.getContext()) : (
                      <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-fg">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" /> : h.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" /> : null}
                      </button>
                    )}
                    {h.column.getCanResize() && (
                      <span onMouseDown={h.getResizeHandler()} onTouchStart={h.getResizeHandler()} className="absolute right-0 top-2 h-5 w-1 cursor-col-resize rounded bg-line opacity-0 hover:opacity-100" aria-hidden />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} onClick={() => router.push(`/trades/${row.original.id}`)} className={cn("cursor-pointer border-b border-line/50 text-fg-2 transition-colors last:border-0 hover:bg-elevated/60", row.getIsSelected() && "bg-gold/[0.05]")} data-testid="trade-row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="num whitespace-nowrap px-3 py-2.5" style={{ width: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {!data.length && (
              <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted">No trades match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-fg-2">
          <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <div className="flex items-center gap-2">
            <Select value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} className="h-8 w-24" aria-label="Rows per page">
              {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </Select>
            <Button size="sm" variant="secondary" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
            <Button size="sm" variant="secondary" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
          </div>
        </div>
      )}

      <BulkDialog open={bulkOpen} onOpenChange={setBulkOpen} ids={selectedIds} strategies={strategies} onDone={() => { setSelection({}); router.refresh(); }} />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={`Delete ${selectedIds.length} trade${selectedIds.length === 1 ? "" : "s"}?`} description="Executions, notes and screenshots are deleted permanently. This cannot be undone.">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" disabled={pending} onClick={() => start(async () => {
              const r = await deleteTrades(selectedIds);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success("Deleted"); setSelection({}); setConfirmDelete(false); router.refresh();
            })}>{pending ? "Deleting…" : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkDialog({ open, onOpenChange, ids, strategies, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; ids: string[]; strategies: Strategy[]; onDone: () => void }) {
  const [tags, setTags] = useState("");
  const [mistakes, setMistakes] = useState("");
  const [strategyId, setStrategyId] = useState("__keep");
  const [session, setSession] = useState("__keep");
  const [pending, start] = useTransition();
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Edit ${ids.length} trade${ids.length === 1 ? "" : "s"}`} description="Bulk edits only change journaling fields. Financial data is never bulk-edited.">
        <div className="space-y-4">
          <Field label="Add tags" hint="Comma separated"><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
          <Field label="Add mistakes" hint="Comma separated"><Input value={mistakes} onChange={(e) => setMistakes(e.target.value)} /></Field>
          <Field label="Strategy"><Select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}><option value="__keep">Keep current</option><option value="">Remove strategy</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Session"><Select value={session} onChange={(e) => setSession(e.target.value)}><option value="__keep">Keep current</option><option value="">Clear</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => {
              const r = await bulkUpdateTrades({
                ids, addTags: split(tags), addMistakes: split(mistakes),
                ...(strategyId !== "__keep" ? { strategyId: strategyId || null } : {}),
                ...(session !== "__keep" ? { session: session || null } : {}),
              });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success("Trades updated"); setTags(""); setMistakes(""); onOpenChange(false); onDone();
            })}>{pending ? "Saving…" : "Apply"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
