import { Download } from "lucide-react";
import { ProfileForm } from "@/components/forms/profile-form";
import { LanguageSwitcher } from "@/components/layout/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/db/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.settings.title };
}

export default async function SettingsPage() {
  const { profile, user } = await requireUser();
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.settings.title} description={user.email} />
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>{t.settings.language}</CardTitle></CardHeader>
          <CardContent><LanguageSwitcher /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.settings.profile}</CardTitle></CardHeader>
          <CardContent><ProfileForm profile={profile} timeZones={Intl.supportedValuesOf("timeZone")} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>{t.settings.data}</CardTitle><CardDescription>{t.settings.dataBody}</CardDescription></div></CardHeader>
          <CardContent><Button asChild variant="secondary"><a href="/api/export" download><Download />{t.settings.exportAll}</a></Button></CardContent>
        </Card>
      </div>
    </>
  );
}
