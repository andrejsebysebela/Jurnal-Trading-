import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { fill } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");
  const { t } = await getI18n();
  return (
    <>
      <h2 className="text-2xl font-semibold">{t.auth.newPasswordTitle}</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">{fill(t.auth.signedInAs, { email: user.email ?? "" })}</p>
      <ResetPasswordForm />
    </>
  );
}
