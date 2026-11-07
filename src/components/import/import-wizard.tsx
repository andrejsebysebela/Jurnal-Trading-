"use client";
import { AlertTriangle, CheckCircle2, FileUp, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ASSET_CLASSES, type AssetClass } from "@/lib/engine";
import {
  autoDetectMapping, DATE_FORMATS, EXECUTION_FIELDS, FIELD_LABELS, normalizeImport, parseCsv, REQUIRED, TRADE_FIELDS, validateMapping,
  type CsvTable, type ImportKind, type ImportMapping,
} from "@/lib/import";
import type { Account, Instrument } from "@/lib/db/types";
import { cn } from "@/lib/utils/cn";
import { plain } from "@/lib/utils/format";
import { runImport } from "@/server/actions/import";
import type { ImportSummary } from "@/server/services/import-service";

const MAX_BYTES = 10 * 1024 * 1024;

export function ImportWizard({ accounts, instruments, savedMappings, defaultTimeZone, defaultAccountId }: {
  accounts: Account[]; instruments: Instrument[]; savedMappings: { name: string; mapping: ImportMapping }[]; defaultTimeZone: string; defaultAccountId: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [symbolSettings, setSymbolSettings] = useState<Record<string, { assetClass: AssetClass; quoteCurrency: string }>>({});
  const [saveAs, setSaveAs] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState(false);
  const account = accounts.find((a) => a.id === accountId);
  const known = useMemo(() => new Map(instruments.map((i) => [i.symbol, i])), [instruments]);

  const load = async (f: File) => {
    if (f.size > MAX_BYTES) { toast.error("File is larger than 10 MB. Split it into smaller files."); return; }
    if (!/\.(csv|txt)$/i.test(f.name)) { toast.error("Please upload a .csv file."); return; }
    const text = await f.text();
    const t = parseCsv(text);
    if (!t.headers.length || !t.rows.length) { toast.error("No rows found. The first line must contain column headers."); return; }
    const detected = autoDetectMapping(t.headers);
    setFile({ name: f.name, text });
    setTable(t);
    setResult(null);
    setMapping({ ...detected, dateFormat: "iso", timeZone: defaultTimeZone, decimalSeparator: ".", profitIsNet: true });
  };

  const preview = useMemo(() => (table && mapping && !validateMapping(mapping).length ? normalizeImport(table, mapping) : null), [table, mapping]);
  const newSymbols = useMemo(() => [...new Set(preview?.trades.map((t) => t.symbol) ?? [])].filter((s) => !known.has(s)).sort(), [preview, known]);
  const mappingErrors = mapping ? validateMapping(mapping) : [];

  const setCol = (field: string, col: string) => setMapping((m) => m && ({ ...m, columns: { ...m.columns, [field]: col || undefined } }));
  const fields = mapping?.kind === "trades" ? TRADE_FIELDS : EXECUTION_FIELDS;

  const submit = () => {
    if (!file || !mapping || !account) return;
    const symbols = newSymbols.map((s) => ({ symbol: s, assetClass: symbolSettings[s]?.assetClass ?? "forex", quoteCurrency: (symbolSettings[s]?.quoteCurrency || account.currency).toUpperCase() }));
    start(async () => {
      const r = await runImport({ accountId, fileName: file.name, csv: file.text, mapping: { ...mapping, columns: Object.fromEntries(Object.entries(mapping.columns).filter(([, v]) => v)) as Record<string, string> }, symbols, saveMappingAs: saveAs || undefined });
      if (!r.ok) { toast.error(r.error); return; }
      setResult(r.data);
      toast.success(`Imported ${r.data.imported} trade(s)`);
      router.refresh();
    });
  };

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3"><CheckCircle2 className="size-6 text-profit" /><h3 className="text-lg font-semibold">Import complete</h3></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="import-summary">
            {[["Rows read", result.rows], ["New trades", result.imported], ["Updated trades", result.updated], ["Duplicates skipped", result.duplicates], ["Rows with errors", result.errors.length]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg bg-elevated/60 p-3"><p className="text-[11px] uppercase tracking-wider text-muted">{k}</p><p className="num mt-1 text-xl font-semibold">{v}</p></div>
            ))}
          </div>
          {result.unavailablePnl > 0 && <p className="flex items-center gap-2 rounded-lg bg-gold/[0.08] p-3 text-sm text-fg-2"><AlertTriangle className="size-4 text-gold" />{result.unavailablePnl} trade(s) need an instrument specification or FX rate before P&amp;L can be calculated. <Link href="/instruments" className="text-gold">Review instruments →</Link></p>}
          {result.errors.length > 0 && <ErrorList errors={result.errors} />}
          <div className="flex gap-2"><Button asChild variant="primary"><Link href="/trades">View trades</Link></Button><Button variant="secondary" onClick={() => { setResult(null); setFile(null); setTable(null); setMapping(null); }}>Import another file</Button></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>1 · File &amp; account</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Field label="Import into account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </Select>
          </Field>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
            onClick={() => fileInput.current?.click()}
            className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors", drag ? "border-gold bg-gold/[0.05]" : "border-line hover:border-gold/50")}
          >
            <FileUp className="mb-2 size-6 text-gold" />
            <p className="text-sm text-fg">{file ? file.name : "Drop a CSV file here or click to browse"}</p>
            <p className="mt-1 text-xs text-muted">{table ? `${table.rows.length} rows · ${table.headers.length} columns` : "Max 10 MB · first row must contain headers"}</p>
            <input ref={fileInput} type="file" accept=".csv,text/csv,.txt" hidden data-testid="csv-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />
          </div>
        </CardContent>
      </Card>

      {table && mapping && (
        <Card>
          <CardHeader>
            <CardTitle>2 · Map columns</CardTitle>
            {savedMappings.length > 0 && (
              <Select className="h-8 w-56" defaultValue="" aria-label="Saved mapping" onChange={(e) => { const m = savedMappings.find((x) => x.name === e.target.value); if (m) setMapping({ ...m.mapping }); }}>
                <option value="">Apply saved mapping…</option>
                {savedMappings.map((m) => <option key={m.name}>{m.name}</option>)}
              </Select>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-5">
              <Field label="File contains">
                <Select value={mapping.kind} onChange={(e) => { const kind = e.target.value as ImportKind; setMapping({ ...mapping, ...autoDetectMapping(table.headers, kind) }); }}>
                  <option value="executions">Executions / fills</option><option value="trades">Closed trades (one per row)</option>
                </Select>
              </Field>
              <Field label="Date format">
                <Select value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value as ImportMapping["dateFormat"] })}>{DATE_FORMATS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select>
              </Field>
              <Field label="Timezone of timestamps" hint="Ignored when timestamps include an offset"><Input value={mapping.timeZone} onChange={(e) => setMapping({ ...mapping, timeZone: e.target.value })} /></Field>
              <Field label="Decimal separator"><Select value={mapping.decimalSeparator} onChange={(e) => setMapping({ ...mapping, decimalSeparator: e.target.value as "." | "," })}><option value=".">1,234.56</option><option value=",">1.234,56</option></Select></Field>
              {mapping.kind === "trades" && (
                <Field label="Profit column is"><Select value={mapping.profitIsNet ? "net" : "gross"} onChange={(e) => setMapping({ ...mapping, profitIsNet: e.target.value === "net" })}><option value="net">Net (after costs)</option><option value="gross">Gross (before costs)</option></Select></Field>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {fields.map((f) => (
                <Field key={f} label={`${FIELD_LABELS[f]}${REQUIRED[mapping.kind].includes(f) ? " *" : ""}`}>
                  <Select value={mapping.columns[f] ?? ""} onChange={(e) => setCol(f, e.target.value)} aria-label={`Column for ${FIELD_LABELS[f]}`} className={cn(REQUIRED[mapping.kind].includes(f) && !mapping.columns[f] && "border-loss/60")}>
                    <option value="">— not in file —</option>
                    {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            {mapping.kind === "trades" && <p className="text-xs text-muted">Broker profit is used to reconcile EDGELOG&apos;s calculation and as a fallback when an instrument specification is missing — it is always flagged.</p>}
            {mappingErrors.length > 0 && <p className="text-sm text-loss">{mappingErrors.join(" ")}</p>}
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader><CardTitle>3 · Preview</CardTitle><span className="text-xs text-muted">{preview.trades.length} trade(s) from {preview.rowCount} rows · {preview.errors.length} row error(s)</span></CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-left"><th className="py-2 font-medium">Symbol</th><th className="font-medium">Direction</th><th className="font-medium">Fills</th><th className="font-medium">Quantity</th><th className="font-medium">Opened (UTC)</th><th className="font-medium">Status</th><th className="font-medium">Broker P&amp;L</th></tr></thead>
                <tbody>
                  {preview.trades.slice(0, 12).map((t) => {
                    const entries = t.executions.filter((e) => e.side === (t.direction === "long" ? "buy" : "sell"));
                    const qty = entries.reduce((a, e) => a + Number(e.quantity), 0);
                    return (
                      <tr key={t.fingerprint} className="num border-b border-line/50 text-fg-2 last:border-0">
                        <td className="py-2 font-medium text-fg">{t.symbol}</td>
                        <td className={t.direction === "long" ? "text-profit" : "text-loss"}>{t.direction}</td>
                        <td>{t.executions.length}</td><td>{plain(String(qty), 4)}</td>
                        <td>{t.executions[0]?.executedAt.replace("T", " ").slice(0, 19)}</td>
                        <td>{t.closed ? "closed" : <Badge tone="gold">open</Badge>}</td>
                        <td>{t.brokerNetPnl ? plain(t.brokerNetPnl, 2) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {preview.trades.length > 12 && <p className="mt-2 text-xs text-muted">…and {preview.trades.length - 12} more</p>}
            </div>
            {preview.errors.length > 0 && <ErrorList errors={preview.errors} />}
          </CardContent>
        </Card>
      )}

      {preview && newSymbols.length > 0 && (
        <Card>
          <CardHeader><CardTitle>4 · New instruments</CardTitle><span className="text-xs text-muted">Contract specs can be completed under Instruments afterwards</span></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {newSymbols.map((s) => (
              <div key={s} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <span className="w-24 truncate text-sm font-medium">{s}</span>
                <Select className="h-8" aria-label={`Asset class for ${s}`} value={symbolSettings[s]?.assetClass ?? "forex"} onChange={(e) => setSymbolSettings((p) => ({ ...p, [s]: { quoteCurrency: p[s]?.quoteCurrency ?? "", assetClass: e.target.value as AssetClass } }))}>
                  {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
                <Input className="h-8 w-20 uppercase" maxLength={3} aria-label={`Quote currency for ${s}`} placeholder={account?.currency ?? "USD"} value={symbolSettings[s]?.quoteCurrency ?? ""} onChange={(e) => setSymbolSettings((p) => ({ ...p, [s]: { assetClass: p[s]?.assetClass ?? "forex", quoteCurrency: e.target.value } }))} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {preview && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Input value={saveAs} onChange={(e) => setSaveAs(e.target.value)} placeholder="Save mapping as… (optional)" className="w-64" />
          <Button variant="primary" size="lg" disabled={pending || !account || !preview.trades.length} onClick={submit}><Upload />{pending ? "Importing…" : `Import ${preview.trades.length} trade(s)`}</Button>
        </div>
      )}
    </div>
  );
}

function ErrorList({ errors }: { errors: { row: number; message: string }[] }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-loss/25 bg-loss/[0.05] p-3 text-sm">
      {errors.slice(0, 100).map((e, i) => <p key={i} className="text-fg-2"><span className="num mr-2 text-loss">Row {e.row}</span>{e.message}</p>)}
      {errors.length > 100 && <p className="mt-1 text-xs text-muted">…{errors.length - 100} more</p>}
    </div>
  );
}
