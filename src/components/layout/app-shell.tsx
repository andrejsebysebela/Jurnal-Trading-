"use client";
import { useCallback, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar, type Notice } from "./topbar";
import type { GlobalFilters } from "@/lib/db/filters";
import type { Account } from "@/lib/db/types";

export function AppShell(props: {
  children: React.ReactNode; filters: GlobalFilters; rangeLabel: string; accounts: Pick<Account, "id" | "name" | "currency">[];
  email: string; displayName: string | null; notices: Notice[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={open} onMobileClose={close} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar {...props} onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-8 lg:py-8">{props.children}</main>
      </div>
    </div>
  );
}
