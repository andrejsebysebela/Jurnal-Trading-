import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-fg-2">The page doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Button asChild variant="primary" className="mt-6"><Link href="/dashboard">Go to dashboard</Link></Button>
    </div>
  );
}
