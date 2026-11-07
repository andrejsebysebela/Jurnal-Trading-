import { AuthForm } from "@/components/auth/auth-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.auth.signIn };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { t } = await getI18n();
  return (
    <>
      <h2 className="text-2xl font-semibold">{t.auth.welcomeBack}</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">{t.auth.signInSubtitle}</p>
      {error === "link" && <p role="alert" className="mb-4 rounded-lg border border-gold/30 bg-gold/[0.08] px-3 py-2 text-sm text-fg-2">{t.auth.linkInvalid}</p>}
      <AuthForm mode="login" next={next} />
    </>
  );
}
