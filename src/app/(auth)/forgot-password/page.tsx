import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.auth.resetTitle };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <>
      <h2 className="text-2xl font-semibold">{t.auth.resetTitle}</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">{t.auth.resetSubtitle}</p>
      <ForgotPasswordForm />
    </>
  );
}
