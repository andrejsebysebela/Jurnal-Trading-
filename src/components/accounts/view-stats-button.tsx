"use client";
import { BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { setGlobalFilters } from "@/server/actions/filters";

/** Select this account in the global filter and open its statistics. */
export function ViewStatsButton({ accountId }: { accountId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { await setGlobalFilters({ accountId }); router.push("/statistics"); router.refresh(); })}>
      <BarChart3 />{t.accounts.viewStats}
    </Button>
  );
}
