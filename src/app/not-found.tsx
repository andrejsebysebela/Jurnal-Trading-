import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 text-sm text-fg-2">{t.errors.notFoundBody}</p>
      <Button asChild variant="primary" className="mt-6"><Link href="/dashboard">{t.errors.toDashboard}</Link></Button>
    </div>
  );
}
