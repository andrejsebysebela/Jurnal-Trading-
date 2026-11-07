import { formatInTimeZone } from "date-fns-tz";
import { Download, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { ImportWizard } from "@/components/import/import-wizard";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportMapping } from "@/lib/import";
import { getGlobalFilters, listAccounts, listInstruments } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";
import { deleteImportBatch } from "@/server/actions/import";

// Server actions on this page (import / recalculation) may run longer than the default.
export const maxDuration = 60;
export const metadata = { title: "Import Trades" };

export default async function ImportPage() {
  const { supabase, profile } = await requireUser();
  const [accounts, instruments, filters, { data: mappings }, { data: batches }] = await Promise.all([
    listAccounts(supabase), listInstruments(supabase), getGlobalFilters(),
    supabase.from("import_mappings").select("name,mapping").order("name"),
    supabase.from("import_batches").select("id,account_id,file_name,kind,row_count,imported_count,duplicate_count,error_count,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const acctName = new Map(accounts.map((a) => [a.id, a.name]));
  return (
    <>
      <PageHeader
        title="Import Trades"
        description="Upload any broker CSV. Map its columns once, preview the result, and EDGELOG calculates every trade server-side. Re-importing the same file never creates duplicates."
        actions={<>
          <Button asChild variant="ghost" size="sm"><a href="/edgelog-template-executions.csv" download><Download />Executions template</a></Button>
          <Button asChild variant="ghost" size="sm"><a href="/edgelog-template-trades.csv" download><Download />Trades template</a></Button>
        </>}
      />
      {!accounts.length ? (
        <EmptyState icon={Wallet} title="Create an account first" description="Imported trades are assigned to an account." action={<Button asChild variant="primary"><Link href="/accounts">Go to accounts</Link></Button>} />
      ) : (
        <ImportWizard
          accounts={accounts}
          instruments={instruments}
          savedMappings={(mappings ?? []) as { name: string; mapping: ImportMapping }[]}
          defaultTimeZone={profile.timezone}
          defaultAccountId={filters.accountId !== "all" ? filters.accountId : accounts.length === 1 ? accounts[0].id : ""}
        />
      )}
      {!!batches?.length && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Import history</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-line text-left"><th className="py-2 font-medium">Date</th><th className="font-medium">File</th><th className="font-medium">Account</th><th className="text-right font-medium">Rows</th><th className="text-right font-medium">Imported</th><th className="text-right font-medium">Duplicates</th><th className="text-right font-medium">Errors</th><th /></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="num border-b border-line/50 text-fg-2 last:border-0">
                    <td className="py-2">{formatInTimeZone(b.created_at, profile.timezone, "MMM d, yyyy HH:mm")}</td>
                    <td className="max-w-56 truncate text-fg">{b.file_name}</td>
                    <td>{acctName.get(b.account_id) ?? "—"}</td>
                    <td className="text-right">{b.row_count}</td><td className="text-right">{b.imported_count}</td><td className="text-right">{b.duplicate_count}</td>
                    <td className={b.error_count ? "text-right text-loss" : "text-right"}>{b.error_count}</td>
                    <td className="text-right">
                      <ConfirmButton variant="ghost" size="sm" action={deleteImportBatch.bind(null, b.id)} title="Undo this import?" description="All trades created by this import (and their notes and screenshots) are deleted." confirmLabel="Undo import" success="Import removed"><Trash2 />Undo</ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
