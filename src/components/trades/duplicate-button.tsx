"use client";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { duplicateTrade } from "@/server/actions/trades";

export function DuplicateButton({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
      const r = await duplicateTrade(id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(t.trade.duplicated);
      router.push(`/trades/${r.data.id}/edit`);
    })}><Copy />{t.trade.duplicate}</Button>
  );
}
