import { formatInTimeZone } from "date-fns-tz";
import type { TradeRow } from "@/lib/db/types";
import { inputDec } from "@/lib/utils/format";
import type { TradeFormValues } from "./trade-form";

const local = (iso: string, tz: string) => formatInTimeZone(iso, tz, "yyyy-MM-dd'T'HH:mm");

export function emptyTradeValues(tz: string, accountId = ""): TradeFormValues {
  const now = formatInTimeZone(new Date(), tz, "yyyy-MM-dd'T'HH:mm");
  return { accountId, symbol: "", direction: "long", openedAt: now, closedAt: now, risk: "", result: "", plannedRR: "", emotion: "", psychology: "", notes: "", tradingviewUrl: "" };
}

export function tradeToValues(t: TradeRow, tz: string): TradeFormValues {
  return {
    id: t.id, accountId: t.account_id, symbol: t.symbol, direction: t.direction,
    openedAt: local(t.opened_at, tz), closedAt: local(t.closed_at ?? t.opened_at, tz),
    risk: inputDec(t.manual_initial_risk ?? t.initial_risk), result: inputDec(t.net_pnl), plannedRR: inputDec(t.planned_rr),
    emotion: t.emotional_state ?? "", psychology: t.psychology_notes ?? "", notes: t.notes ?? "", tradingviewUrl: t.tradingview_url ?? "",
  };
}
