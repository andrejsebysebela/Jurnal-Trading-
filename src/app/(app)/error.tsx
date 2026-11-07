"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/config";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Error</p>
      <h1 className="mt-2 text-2xl font-semibold">{t.errors.title}</h1>
      <p className="mt-2 max-w-md text-sm text-fg-2">{t.errors.body}{error.digest ? ` ${fill(t.errors.reference, { ref: error.digest })}` : ""}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>{t.errors.tryAgain}</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>{t.errors.toDashboard}</Button>
      </div>
    </div>
  );
}
