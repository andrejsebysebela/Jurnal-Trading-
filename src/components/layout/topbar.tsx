"use client";
import { Bell, CalendarRange, ChevronDown, Languages, LogOut, Menu, Plus, Search, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { RANGE_PRESETS, type GlobalFilters } from "@/lib/db/filters";
import type { Account } from "@/lib/db/types";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import { signOut } from "@/server/actions/auth";
import { setGlobalFilters } from "@/server/actions/filters";
import { setLocale } from "@/server/actions/management";

export interface Notice { id: string; title: string; body: string; href: string; tone: "warning" | "danger" | "info" }

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const change = (l: Locale) => start(async () => { await setLocale(l); router.refresh(); });
  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-line bg-card p-0.5", pending && "opacity-60")} role="group" aria-label={t.common.language}>
      {!compact && <Languages className="ml-1.5 size-3.5 text-muted" aria-hidden />}
      {(["sk", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          aria-pressed={locale === l}
          className={cn("rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors", locale === l ? "bg-elevated text-gold" : "text-muted hover:text-fg")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Topbar({ filters, rangeLabel, accounts, email, displayName, notices, onMenu }: {
  filters: GlobalFilters; rangeLabel: string; accounts: Pick<Account, "id" | "name" | "currency">[]; email: string; displayName: string | null; notices: Notice[]; onMenu: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const apply = (f: Partial<GlobalFilters>) => start(async () => { await setGlobalFilters(f); router.refresh(); });
  const account = accounts.find((a) => a.id === filters.accountId);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line/60 bg-bg/85 px-4 backdrop-blur-md sm:gap-3 lg:px-6">
      <button onClick={onMenu} className="rounded-md p-1.5 text-fg-2 hover:bg-elevated lg:hidden" aria-label={t.nav.openMenu}><Menu className="size-5" /></button>
      <form className="relative hidden max-w-xs flex-1 md:block" onSubmit={(e) => { e.preventDefault(); router.push(`/trades${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); }}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.topbar.search} className="pl-9" aria-label={t.common.search} />
      </form>
      <div className={cn("ml-auto flex items-center gap-2", pending && "opacity-70")}>
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="sm" className="h-9" data-testid="range-picker" aria-label={t.topbar.dateRange}>
              <CalendarRange className="text-gold" /><span className="hidden sm:inline">{rangeLabel}</span><ChevronDown className="text-muted" />
            </Button>
          </DropdownTrigger>
          <DropdownContent className="w-64">
            <DropdownLabel>{t.topbar.dateRange}</DropdownLabel>
            {RANGE_PRESETS.filter((p) => p.id !== "custom").map((p) => (
              <DropdownItem key={p.id} onSelect={() => apply({ range: p.id })} className={cn(filters.range === p.id && "text-gold")}>{t.ranges[p.id]}</DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownLabel>{t.topbar.custom}</DropdownLabel>
            <div className="space-y-2 px-2.5 pb-2" onKeyDown={(e) => e.stopPropagation()}>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t.topbar.from} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t.topbar.to} />
              <Button size="sm" variant="primary" className="w-full" disabled={!from || !to || from > to} onClick={() => apply({ range: "custom", from, to })}>{t.common.apply}</Button>
            </div>
          </DropdownContent>
        </Dropdown>
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="sm" className="h-9 max-w-[200px]" data-testid="account-picker">
              <Wallet className="text-gold" /><span className="hidden truncate sm:inline">{account?.name ?? t.topbar.allAccounts}</span><ChevronDown className="text-muted" />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem onSelect={() => apply({ accountId: "all" })} className={cn(filters.accountId === "all" && "text-gold")}>{t.topbar.allAccounts}</DropdownItem>
            {accounts.length > 0 && <DropdownSeparator />}
            {accounts.map((a) => (
              <DropdownItem key={a.id} onSelect={() => apply({ accountId: a.id })} className={cn(filters.accountId === a.id && "text-gold")}>
                <span className="flex-1 truncate">{a.name}</span><span className="text-[11px] text-muted">{a.currency}</span>
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem asChild><Link href="/accounts">{t.topbar.manageAccounts}</Link></DropdownItem>
          </DropdownContent>
        </Dropdown>
        <div className="hidden md:block"><LanguageSwitcher compact /></div>
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="relative rounded-lg p-2 text-fg-2 hover:bg-elevated hover:text-fg" aria-label={`${t.topbar.notifications} (${notices.length})`}>
              <Bell className="size-[18px]" />
              {notices.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-gold ring-2 ring-bg" />}
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-80">
            <DropdownLabel>{t.topbar.notifications}</DropdownLabel>
            {notices.length === 0 && <p className="px-2.5 py-3 text-sm text-muted">{t.topbar.caughtUp}</p>}
            {notices.map((n) => (
              <DropdownItem key={n.id} asChild>
                <Link href={n.href} className="!items-start">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.tone === "danger" ? "bg-loss" : n.tone === "warning" ? "bg-gold" : "bg-fg-2")} />
                  <span><span className="block text-fg">{n.title}</span><span className="block text-xs text-muted">{n.body}</span></span>
                </Link>
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
        <Button asChild variant="primary" size="sm" className="h-9">
          <Link href="/trades/new"><Plus /><span className="hidden sm:inline">{t.topbar.addTrade}</span></Link>
        </Button>
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex size-9 items-center justify-center rounded-full border border-line bg-elevated text-xs font-semibold text-gold" aria-label={t.topbar.userMenu}>
              {(displayName ?? email).slice(0, 2).toUpperCase()}
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <div className="px-2.5 py-2">
              <p className="text-sm text-fg">{displayName ?? t.topbar.trader}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <div className="px-2.5 pb-2 md:hidden"><LanguageSwitcher /></div>
            <DropdownSeparator />
            <DropdownItem asChild><Link href="/settings"><Settings />{t.topbar.settings}</Link></DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => start(() => signOut())}><LogOut />{t.topbar.signOut}</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
