"use client";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money } from "@/lib/utils/format";
import { C, axisProps, compactMoney } from "./theme";
import { ChartTooltip } from "./tooltip";

const toneOf = (n: number): "profit" | "loss" | "neutral" => (n > 0 ? "profit" : n < 0 ? "loss" : "neutral");
const fmt = (n: number, cur: string) => money(String(n), cur, { sign: true });

export interface EquityDatum { date: string; cumulative: number; daily: number; equity: number | null }

export function EquityCurve({ data, currency, showBalance }: { data: EquityDatum[]; currency: string; showBalance?: boolean }) {
  const [mode, setMode] = useState<"pnl" | "balance">("pnl");
  const key = showBalance && mode === "balance" ? "equity" : "cumulative";
  const last = data.at(-1)?.[key] ?? 0;
  const stroke = (last ?? 0) >= 0 ? C.gold : C.loss;
  return (
    <div>
      {showBalance && (
        <div className="mb-2 flex justify-end gap-1 text-xs">
          {(["pnl", "balance"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-2 py-1 ${mode === m ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}>
              {m === "pnl" ? "Cumulative P&L" : "Account balance"}
            </button>
          ))}
        </div>
      )}
      <div className="h-[280px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eq" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => format(parseISO(d), "MMM d")} minTickGap={40} />
            <YAxis {...axisProps} width={64} tickFormatter={(v) => compactMoney(v, currency)} domain={key === "cumulative" ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ["auto", "auto"]} />
            {key === "cumulative" && <ReferenceLine y={0} stroke="#3a4250" />}
            <Tooltip
              cursor={{ stroke: "#3a4250", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as EquityDatum;
                return (
                  <ChartTooltip title={format(parseISO(d.date), "EEE, MMM d yyyy")} rows={[
                    { label: "Day P&L", value: fmt(d.daily, currency), tone: toneOf(d.daily) },
                    { label: "Cumulative", value: fmt(d.cumulative, currency), tone: toneOf(d.cumulative) },
                    ...(d.equity !== null ? [{ label: "Balance", value: money(String(d.equity), currency) }] : []),
                  ]} />
                );
              }}
            />
            <Area type="monotone" dataKey={key} stroke={stroke} strokeWidth={2} fill="url(#eq)" dot={false} activeDot={{ r: 4, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DailyPnlBars({ data, currency, height = 240 }: { data: { date: string; pnl: number; trades: number }[]; currency: string; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => format(parseISO(d), "MMM d")} minTickGap={30} />
          <YAxis {...axisProps} width={64} tickFormatter={(v) => compactMoney(v, currency)} />
          <ReferenceLine y={0} stroke="#3a4250" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { date: string; pnl: number; trades: number };
              return <ChartTooltip title={format(parseISO(d.date), "EEE, MMM d yyyy")} rows={[{ label: "Net P&L", value: fmt(d.pnl, currency), tone: toneOf(d.pnl) }, { label: "Trades", value: String(d.trades) }]} />;
            }}
          />
          <Bar dataKey="pnl" radius={[3, 3, 3, 3]} maxBarSize={22} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.date} fill={d.pnl >= 0 ? C.profit : C.loss} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBars({ data, currency }: { data: { month: string; pnl: number; trades: number }[]; currency: string }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => format(parseISO(`${m}-01`), "MMM")} interval={0} />
          <YAxis {...axisProps} width={64} tickFormatter={(v) => compactMoney(v, currency)} />
          <ReferenceLine y={0} stroke="#3a4250" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { month: string; pnl: number; trades: number };
              return <ChartTooltip title={format(parseISO(`${d.month}-01`), "MMMM yyyy")} rows={[{ label: "Net P&L", value: fmt(d.pnl, currency), tone: toneOf(d.pnl) }, { label: "Trades", value: String(d.trades) }]} />;
            }}
          />
          <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={34} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.month} fill={d.pnl > 0 ? C.profit : d.pnl < 0 ? C.loss : C.neutral} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars for group comparisons (strategy, instrument, weekday…). */
export function GroupBars({ data, currency, height }: { data: { label: string; pnl: number; trades: number; winRate: string }[]; currency: string; height?: number }) {
  const h = height ?? Math.max(120, data.length * 34 + 20);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={(v) => compactMoney(v, currency)} />
          <YAxis type="category" dataKey="label" {...axisProps} width={96} tick={{ fill: "#929BA9", fontSize: 12 }} />
          <ReferenceLine x={0} stroke="#3a4250" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { label: string; pnl: number; trades: number; winRate: string };
              return <ChartTooltip title={d.label} rows={[{ label: "Net P&L", value: fmt(d.pnl, currency), tone: toneOf(d.pnl) }, { label: "Trades", value: String(d.trades) }, { label: "Win rate", value: d.winRate }]} />;
            }}
          />
          <Bar dataKey="pnl" radius={[3, 3, 3, 3]} maxBarSize={18} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.label} fill={d.pnl >= 0 ? C.profit : C.loss} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WinLossDonut({ wins, losses, breakevens }: { wins: number; losses: number; breakevens: number }) {
  const data = useMemo(() => [
    { name: "Wins", value: wins, color: C.profit },
    { name: "Losses", value: losses, color: C.loss },
    { name: "Breakeven", value: breakevens, color: C.neutral },
  ], [wins, losses, breakevens]);
  const total = wins + losses + breakevens;
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-[150px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={total ? data : [{ name: "None", value: 1, color: "#262D38" }]} dataKey="value" innerRadius={52} outerRadius={70} paddingAngle={total ? 2 : 0} stroke={C.surface} strokeWidth={2} isAnimationActive={false}>
              {(total ? data : [{ color: "#262D38" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {total > 0 && <Tooltip content={({ active, payload }) => active && payload?.length ? <ChartTooltip title={String(payload[0].name)} rows={[{ label: "Trades", value: `${payload[0].value} (${((Number(payload[0].value) / total) * 100).toFixed(1)}%)` }]} /> : null} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl font-semibold">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">trades</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="w-20 text-fg-2">{d.name}</span>
            <span className="num font-semibold text-fg">{d.value}</span>
            <span className="num text-xs text-muted">{total ? `${((d.value / total) * 100).toFixed(0)}%` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Histogram({ data }: { data: { bucket: string; count: number; negative: boolean }[] }) {
  return (
    <div className="h-[220px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bucket" {...axisProps} interval={0} fontSize={10} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <ChartTooltip title={String((payload[0].payload as { bucket: string }).bucket)} rows={[{ label: "Trades", value: String(payload[0].value) }]} /> : null} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.bucket} fill={d.negative ? C.loss : C.profit} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Line of a 0–100 score over time (discipline, win rate). */
export function ScoreLine({ data, label }: { data: { x: string; y: number | null }[]; label: string }) {
  return (
    <div className="h-[220px]">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="x" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} domain={[0, 100]} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <ChartTooltip title={String((payload[0].payload as { x: string }).x)} rows={[{ label, value: payload[0].value == null ? "—" : `${Number(payload[0].value).toFixed(1)}` }]} /> : null} />
          <Area type="monotone" dataKey="y" stroke={C.gold} strokeWidth={2} fill={C.gold} fillOpacity={0.08} connectNulls dot={{ r: 3, fill: C.gold, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
