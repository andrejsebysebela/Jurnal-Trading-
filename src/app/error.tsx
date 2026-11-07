"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Error</p>
      <h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-fg-2">Your data is safe. Try again, and if the problem persists contact support{error.digest ? ` with reference ${error.digest}` : ""}.</p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>Go to dashboard</Button>
      </div>
    </div>
  );
}
