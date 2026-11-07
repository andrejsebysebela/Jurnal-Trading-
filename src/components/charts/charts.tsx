"use client";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n/client";
import { C, axisProps } from "./theme";
import { ChartTooltip } from "./tooltip";

type Tone = "profit" | "loss" | "neutral";
const toneOf = (n: number): Tone => (n > 0 ? "profit" : n < 0 ? "loss" : "neutral");

/** Chart values arrive as numbers (display only); money labels are formatted per locale. */
function useChartFmt(currency: string) {
  const { t, f } = useI18n();
  return {
    t, f,
    money: (n: number) => f.money(String(n), currency, { sign: true }),
    axis: (n: number) => f.axisMoney(n, currency),
    day: (d: string, pattern: string) => format(parseISO(d), pattern, { locale: f.dfLocale }),
  };
}

export interface EquityDatum { date: string; cumulative: number; daily: number; equity: number | null }

export function EquityCurve({ data, currency, showBalance }: { data: EquityDatum[]; currency: string; showBalance?: boolean }) {
  const { t, f, money, axis, day } = useChartFmt(currency);
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
              {m === "pnl" ? t.stats.cumulative : t.stats.balance}
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
            <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => day(d, "d MMM")} minTickGap={40} />
            <YAxis {...axisProps} width={70} tickFormatter={axis} domain={key === "cumulative" ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)] : ["auto", "auto"]} />
            {key === "cumulative" && <ReferenceLine y={0} stroke="#3a4250" />}
            <Tooltip
              cursor={{ stroke: "#3a4250", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as EquityDatum;
                return (
                  <ChartTooltip title={day(d.date, "EEEE d MMM yyyy")} rows={[
                    { label: t.stats.dayPnl, value: money(d.daily), tone: toneOf(d.daily) },
                    { label: t.stats.cumulative, value: money(d.cumulative), tone: toneOf(d.cumulative) },
                    ...(d.equity !== null ? [{ label: t.stats.balance, value: f.money(String(d.equity), currency) }] : []),
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
  const { t, money, axis, day } = useChartFmt(currency);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => day(d, "d MMM")} minTickGap={30} />
          <YAxis {...axisProps} width={70} tickFormatter={axis} />
          <ReferenceLine y={0} stroke="#3a4250" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { date: string; pnl: number; trades: number };
              return <ChartTooltip title={day(d.date, "EEEE d MMM yyyy")} rows={[{ label: t.stats.netPnl, value: money(d.pnl), tone: toneOf(d.pnl) }, { label: t.stats.trades, value: String(d.trades) }]} />;
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
  const { t, money, axis, day } = useChartFmt(currency);
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => day(`${m}-01`, "LLL")} interval={0} />
          <YAxis {...axisProps} width={70} tickFormatter={axis} />
          <ReferenceLine y={0} stroke="#3a4250" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { month: string; pnl: number; trades: number };
              return <ChartTooltip title={day(`${d.month}-01`, "LLLL yyyy")} rows={[{ label: t.stats.netPnl, value: money(d.pnl), tone: toneOf(d.pnl) }, { label: t.stats.trades, value: String(d.trades) }]} />;
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

/** Horizontal ranked bars for group comparisons (pair, weekday, emotion, account…). */
export function GroupBars({ data, currency, height }: { data: { label: string; pnl: number; trades: number; winRate: string }[]; currency: string; height?: number }) {
  const { t, money, axis } = useChartFmt(currency);
  const h = height ?? Math.max(120, data.length * 34 + 20);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={axis} />
          <YAxis type="category" dataKey="label" {...axisProps} width={100} tick={{ fill: "#929BA9", fontSize: 12 }} />
          <ReferenceLine x={0} stroke="#3a4250" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { label: string; pnl: number; trades: number; winRate: string };
              return <ChartTooltip title={d.label} rows={[{ label: t.stats.netPnl, value: money(d.pnl), tone: toneOf(d.pnl) }, { label: t.stats.trades, value: String(d.trades) }, { label: t.stats.winRate, value: d.winRate }]} />;
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
  const { t, f } = useI18n();
  const data = useMemo(() => [
    { name: t.common.wins, value: wins, color: C.profit },
    { name: t.common.losses, value: losses, color: C.loss },
    { name: t.common.breakeven, value: breakevens, color: C.neutral },
  ], [wins, losses, breakevens, t]);
  const total = wins + losses + breakevens;
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-[150px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={total ? data : [{ name: "-", value: 1, color: "#262D38" }]} dataKey="value" innerRadius={52} outerRadius={70} paddingAngle={total ? 2 : 0} stroke={C.surface} strokeWidth={2} isAnimationActive={false}>
              {(total ? data : [{ color: "#262D38" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {total > 0 && <Tooltip content={({ active, payload }) => active && payload?.length ? <ChartTooltip title={String(payload[0].name)} rows={[{ label: t.stats.trades, value: `${payload[0].value} (${f.pct((Number(payload[0].value) / total) * 100)})` }]} /> : null} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl font-semibold">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">{t.stats.trades}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="w-20 text-fg-2">{d.name}</span>
            <span className="num font-semibold text-fg">{d.value}</span>
            <span className="num whitespace-nowrap text-xs text-muted">{total ? f.pct((d.value / total) * 100, 0) : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Histogram({ data }: { data: { bucket: string; count: number; negative: boolean }[] }) {
  const { t } = useI18n();
  return (
    <div className="h-[220px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bucket" {...axisProps} interval={0} fontSize={10} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <ChartTooltip title={String((payload[0].payload as { bucket: string }).bucket)} rows={[{ label: t.stats.trades, value: String(payload[0].value) }]} /> : null} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.bucket} fill={d.negative ? C.loss : C.profit} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
