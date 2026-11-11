import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/landing";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: { absolute: t.landing.metaTitle }, description: t.landing.metaDescription };
}

/** Public 3D landing page; signed-in users go straight to their dashboard. */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <Landing />;
}
