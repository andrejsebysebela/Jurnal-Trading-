import { formatInTimeZone } from "date-fns-tz";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pnl } from "@/components/shared/pnl";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listAccounts, listFilteredTrades } from "@/lib/db/queries";
import { tradeTagNames } from "@/lib/db/tag-names";
import { requireUser } from "@/lib/db/session";
import { rMultiple } from "@/lib/utils/format";

export const metadata = { title: "Trade Notes" };

const FIELDS = [
  ["note_entry_reason", "Why I entered"], ["note_expectation", "What I expected"], ["note_exit_reason", "Why I exited"],
  ["note_did_well", "Did well"], ["note_did_wrong", "Did wrong"], ["note_lesson", "Lesson"], ["notes", "Notes"],
] as const;

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const ctx = await requireUser();
  const { q = "", f = "" } = await searchParams;
  const [{ trades, range }, accounts] = await Promise.all([listFilteredTrades(ctx), listAccounts(ctx.supabase)]);
  const cur = new Map(accounts.map((a) => [a.id, a.currency]));
  const needle = q.trim().toLowerCase();
  const withNotes = trades.filter((t) => {
    const texts = FIELDS.filter(([k]) => !f || k === f).map(([k]) => t[k]).filter(Boolean) as string[];
    if (!texts.length) return false;
    return !needle || texts.join(" ").toLowerCase().includes(needle) || t.symbol.toLowerCase().includes(needle);
  });

  return (
    <>
      <PageHeader title="Trade Notes" description={`Every written reflection in one place · ${range.label}`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search notes…" className="max-w-sm" aria-label="Search notes" />
        <select name="f" defaultValue={f} className="h-9 rounded-lg border border-line bg-[#0f131a] px-3 text-sm" aria-label="Note field">
          <option value="">All note fields</option>{FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="h-9 rounded-lg border border-line px-4 text-sm text-fg-2 hover:text-fg">Filter</button>
      </form>
      {!withNotes.length ? (
        <EmptyState icon={BookOpen} title={needle ? "No notes match your search" : "No trade notes in this period"} description="Write notes on any trade's detail page — why you entered, what you expected and what you learned." />
      ) : (
        <div className="space-y-3">
          {withNotes.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link href={`/trades/${t.id}`} className="font-semibold hover:text-gold">{t.symbol}</Link>
                <Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction}</Badge>
                <span className="text-xs text-muted">{formatInTimeZone(t.activity_at, ctx.profile.timezone, "EEE, MMM d yyyy HH:mm")}</span>
                <span className="ml-auto flex items-center gap-3 text-sm"><Pnl value={t.net_pnl} currency={cur.get(t.account_id) ?? "USD"} /><span className="num text-fg-2">{rMultiple(t.r_multiple)}</span></span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {FIELDS.filter(([k]) => t[k]).map(([k, label]) => (
                  <div key={k}><p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold/90">{label}</p><p className="whitespace-pre-wrap text-sm text-fg-2">{t[k]}</p></div>
                ))}
              </div>
              {tradeTagNames(t, "mistake").length > 0 && <div className="mt-3 flex gap-1">{tradeTagNames(t, "mistake").map((m) => <Badge key={m} tone="loss">{m}</Badge>)}</div>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
