import { AuthForm } from "@/components/auth/auth-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.auth.createAccount };
}

export default async function SignupPage() {
  const { t } = await getI18n();
  return (
    <>
      <h2 className="text-2xl font-semibold">{t.auth.createTitle}</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">{t.auth.createSubtitle}</p>
      <AuthForm mode="signup" />
    </>
  );
}
