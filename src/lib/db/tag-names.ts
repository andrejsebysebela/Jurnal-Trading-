import type { Tag, TradeRow } from "./types";

export function tradeTagNames(t: Pick<TradeRow, "trade_tags">, kind: Tag["kind"]): string[] {
  return (t.trade_tags ?? []).filter((x) => x.tags?.kind === kind).map((x) => x.tags!.name);
}
