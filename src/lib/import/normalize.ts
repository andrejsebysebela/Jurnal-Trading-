import { groupExecutionsIntoTrades, type ExecutionInput, type GroupableExecution, D } from "@/lib/engine";
import { type ImportMapping, REQUIRED, parseSide, FIELD_LABELS } from "./mapping";
import { type CsvTable, fingerprint, parseNumber, parseTimestamp } from "./parse";

export interface RowError { row: number; message: string }

export interface ImportedTrade {
  symbol: string;
  accountKey: string | null;
  direction: "long" | "short";
  executions: (ExecutionInput & { fingerprint: string; externalId: string | null })[];
  stopLoss: string | null;
  takeProfit: string | null;
  swap: string | null;
  brokerNetPnl: string | null;
  closed: boolean;
  fingerprint: string;
  sourceRows: number[];
}

export interface NormalizeResult {
  trades: ImportedTrade[];
  errors: RowError[];
  rowCount: number;
}

export function validateMapping(mapping: ImportMapping): string[] {
  return REQUIRED[mapping.kind].filter((f) => !mapping.columns[f]).map((f) => `Map a column to "${FIELD_LABELS[f]}".`);
}

/** Convert raw CSV rows into engine-ready trades. Never drops a row silently. */
export function normalizeImport(table: CsvTable, mapping: ImportMapping): NormalizeResult {
  const errors: RowError[] = [];
  const col = (row: Record<string, string>, field: string) => {
    const c = mapping.columns[field];
    return c ? row[c] : undefined;
  };
  const num = (row: Record<string, string>, field: string) => parseNumber(col(row, field), mapping.decimalSeparator);
  const time = (row: Record<string, string>, field: string) => parseTimestamp(col(row, field), mapping.dateFormat, mapping.timeZone);
  const abs = (v: string | null) => (v ? new D(v).abs().toFixed() : null);

  if (mapping.kind === "executions") {
    const execs: (GroupableExecution & { row: number; fingerprint: string; externalId: string | null })[] = [];
    const seen = new Map<string, number>();
    table.rows.forEach((row, i) => {
      const rowNo = i + 2; // header is row 1
      const symbol = col(row, "symbol")?.trim();
      const side = parseSide(col(row, "side"));
      const quantity = num(row, "quantity");
      const price = num(row, "price");
      const executedAt = time(row, "executedAt");
      const problems = [
        !symbol && "missing symbol",
        !side && `unrecognised side "${col(row, "side") ?? ""}"`,
        (!quantity || new D(quantity).isZero()) && "invalid quantity",
        (!price || new D(price).lt(0)) && "invalid price",
        !executedAt && `unparseable time "${col(row, "executedAt") ?? ""}"`,
      ].filter(Boolean);
      if (problems.length) { errors.push({ row: rowNo, message: problems.join(", ") }); return; }
      const externalId = col(row, "externalId")?.trim() || null;
      const accountKey = col(row, "account")?.trim() || undefined;
      execs.push({
        row: rowNo,
        symbol: symbol!.toUpperCase(),
        accountKey,
        side: side!,
        quantity: abs(quantity)!,
        price: price!,
        executedAt: executedAt!,
        commission: abs(num(row, "commission")),
        fee: abs(num(row, "fee")),
        externalId,
        fingerprint: "",
      });
      const last = execs[execs.length - 1];
      const fpBase = fingerprint(externalId ? ["x", accountKey, externalId] : [accountKey, symbol, side, quantity, price, executedAt]);
      const occurrence = (seen.get(fpBase) ?? 0) + 1;
      seen.set(fpBase, occurrence);
      // Identical rows in one file stay distinct; re-importing the same file yields the same fingerprints.
      last.fingerprint = occurrence === 1 ? fpBase : `${fpBase}#${occurrence}`;
    });
    const meta = new Map(execs.map((e) => [e.fingerprint, e]));
    const baseOf = (id?: string) => (id ?? "").replace(/:(open|close)$/, "");
    const groups = groupExecutionsIntoTrades(execs.map((e) => ({ ...e, id: e.fingerprint })));
    const trades: ImportedTrade[] = groups.map((g) => {
      const executions = g.executions.map((x) => {
        const src = meta.get(baseOf(x.id));
        // Strip import-only fields so executions are pure engine inputs.
        const { row: _row, symbol: _s, accountKey: _a, ...rest } = x as typeof x & { row?: number; symbol?: string; accountKey?: string };
        return { ...rest, fingerprint: x.id!, externalId: src?.externalId ?? null };
      });
      return {
        symbol: g.symbol,
        accountKey: g.accountKey ?? null,
        direction: g.direction,
        executions,
        stopLoss: null, takeProfit: null, swap: null, brokerNetPnl: null,
        closed: g.closed,
        fingerprint: fingerprint(executions.map((e) => e.fingerprint)),
        sourceRows: [...new Set(executions.map((e) => meta.get(baseOf(e.fingerprint))?.row ?? 0))],
      };
    });
    return { trades, errors, rowCount: table.rows.length };
  }

  const trades: ImportedTrade[] = [];
  table.rows.forEach((row, i) => {
    const rowNo = i + 2;
    const symbol = col(row, "symbol")?.trim();
    const side = parseSide(col(row, "side"));
    const quantity = abs(num(row, "quantity"));
    const entry = num(row, "entryPrice");
    const exit = num(row, "exitPrice");
    const openedAt = time(row, "openedAt");
    const closedAt = time(row, "closedAt");
    const problems = [
      !symbol && "missing symbol",
      !side && `unrecognised side "${col(row, "side") ?? ""}"`,
      (!quantity || new D(quantity).isZero()) && "invalid quantity",
      !entry && "invalid entry price",
      !exit && "invalid exit price",
      !openedAt && "unparseable open time",
      !closedAt && "unparseable close time",
      openedAt && closedAt && closedAt < openedAt && "close time is before open time",
    ].filter(Boolean);
    if (problems.length) { errors.push({ row: rowNo, message: problems.join(", ") }); return; }
    const externalId = col(row, "externalId")?.trim() || null;
    const accountKey = col(row, "account")?.trim() || null;
    const commission = abs(num(row, "commission"));
    const fee = abs(num(row, "fee"));
    const swap = num(row, "swap");
    let profit = num(row, "profit");
    if (profit && !mapping.profitIsNet) {
      // Gross broker profit → net using the mapped costs.
      profit = new D(profit).minus(commission ?? 0).minus(fee ?? 0).plus(swap ?? 0).toFixed();
    }
    const fp = fingerprint(externalId ? ["t", accountKey, externalId] : [accountKey, symbol, side, quantity, entry, exit, openedAt, closedAt]);
    const exitSide = side === "buy" ? "sell" : "buy";
    trades.push({
      symbol: symbol!.toUpperCase(),
      accountKey,
      direction: side === "buy" ? "long" : "short",
      executions: [
        { side: side!, quantity: quantity!, price: entry!, executedAt: openedAt!, commission, fee, fingerprint: `${fp}:in`, externalId },
        { side: exitSide, quantity: quantity!, price: exit!, executedAt: closedAt!, fingerprint: `${fp}:out`, externalId },
      ],
      stopLoss: num(row, "stopLoss"),
      takeProfit: num(row, "takeProfit"),
      swap,
      brokerNetPnl: profit,
      closed: true,
      fingerprint: fp,
      sourceRows: [rowNo],
    });
  });
  return { trades, errors, rowCount: table.rows.length };
}
