import { formatInTimeZone } from "date-fns-tz";
import type { TradeWithRelations } from "@/lib/db/types";
import { tradeTagNames } from "@/lib/db/tag-names";
import { inputDec } from "@/lib/utils/format";
import type { TradeFormValues } from "./trade-form";

const local = (iso: string, tz: string) => formatInTimeZone(iso, tz, "yyyy-MM-dd'T'HH:mm:ss");

export function emptyTradeValues(tz: string, accountId = ""): TradeFormValues {
  const now = formatInTimeZone(new Date(), tz, "yyyy-MM-dd'T'HH:mm:00");
  return {
    accountId, symbol: "", assetClass: "forex", direction: "long", quoteCurrency: "",
    executions: [
      { role: "entry", quantity: "", price: "", executedAt: now, fee: "", commission: "" },
      { role: "exit", quantity: "", price: "", executedAt: now, fee: "", commission: "" },
    ],
    stopLoss: "", takeProfit: "", manualInitialRisk: "", swap: "", strategyId: "", setup: "", session: "", timeframe: "",
    tagsText: "", mistakesText: "", emotionalState: "", rating: "", confidence: "", disciplineRating: "", ruleCompliant: "",
    checklistState: {}, noteEntryReason: "", noteExpectation: "", noteExitReason: "", noteDidWell: "", noteDidWrong: "", noteLesson: "", notes: "",
  };
}

export function tradeToValues(t: TradeWithRelations, tz: string): TradeFormValues {
  const entrySide = t.direction === "long" ? "buy" : "sell";
  return {
    id: t.id, accountId: t.account_id, symbol: t.symbol, assetClass: t.asset_class, direction: t.direction, quoteCurrency: t.pnl_currency ?? "",
    executions: t.executions.map((e) => ({
      role: e.side === entrySide ? "entry" : "exit", quantity: inputDec(e.quantity), price: inputDec(e.price),
      executedAt: local(e.executed_at, tz), fee: inputDec(e.fee) === "0" ? "" : inputDec(e.fee), commission: inputDec(e.commission) === "0" ? "" : inputDec(e.commission),
    })),
    stopLoss: inputDec(t.stop_loss), takeProfit: inputDec(t.take_profit), manualInitialRisk: inputDec(t.manual_initial_risk),
    swap: inputDec(t.swap) === "0" ? "" : inputDec(t.swap), strategyId: t.strategy_id ?? "", setup: t.setup ?? "", session: t.session ?? "",
    timeframe: t.timeframe ?? "", tagsText: tradeTagNames(t, "tag").join(", "), mistakesText: tradeTagNames(t, "mistake").join(", "),
    emotionalState: t.emotional_state ?? "", rating: t.rating ? String(t.rating) : "", confidence: t.confidence ? String(t.confidence) : "",
    disciplineRating: t.discipline_rating ? String(t.discipline_rating) : "", ruleCompliant: t.rule_compliant === null ? "" : t.rule_compliant ? "yes" : "no",
    checklistState: t.checklist_state ?? {}, noteEntryReason: t.note_entry_reason ?? "", noteExpectation: t.note_expectation ?? "",
    noteExitReason: t.note_exit_reason ?? "", noteDidWell: t.note_did_well ?? "", noteDidWrong: t.note_did_wrong ?? "", noteLesson: t.note_lesson ?? "", notes: t.notes ?? "",
  };
}
