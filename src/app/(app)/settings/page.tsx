import { Download } from "lucide-react";
import { FxRates, ProfileForm, RecalculateButton, TagManager } from "@/components/forms/settings-forms";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listFxRates, listTags } from "@/lib/db/queries";
import { requireUser } from "@/lib/db/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, profile, user } = await requireUser();
  const [rates, tags] = await Promise.all([listFxRates(supabase), listTags(supabase)]);
  const timeZones = Intl.supportedValuesOf("timeZone");
  return (
    <>
      <PageHeader title="Settings" description={user.email} />
      <div className="space-y-4">
        <Card>
          <CardHeader><div><CardTitle>Profile &amp; calculation preferences</CardTitle><CardDescription>Changing matching, tolerance or FX staleness recalculates all trades.</CardDescription></div></CardHeader>
          <CardContent><ProfileForm profile={profile} timeZones={timeZones} /></CardContent>
        </Card>
        <Card id="fx">
          <CardHeader><div><CardTitle>Historical FX rates</CardTitle><CardDescription>Used to convert P&amp;L when an instrument&apos;s currency differs from the account currency. Rates are applied by trade close date — today&apos;s rate is never substituted for a missing historical one.</CardDescription></div></CardHeader>
          <CardContent><FxRates rates={rates} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tags &amp; mistakes</CardTitle></CardHeader>
          <CardContent><TagManager tags={tags} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Data</CardTitle><CardDescription>Executions are the source of truth; every metric can be rebuilt from them.</CardDescription></div></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <RecalculateButton />
            <Button asChild variant="secondary"><a href="/api/export" download><Download />Export all data (JSON)</a></Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
