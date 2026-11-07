"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/client";
import { Logo } from "./logo";
import { NAV } from "./nav";

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("edgelog.sidebar") === "1"); } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("edgelog.sidebar", c ? "0" : "1"); } catch {}
      return !c;
    });
  };
  useEffect(() => { onMobileClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const content = (isMobile: boolean) => {
    const c = collapsed && !isMobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 items-center border-b border-line/60", c ? "justify-center px-2" : "justify-between px-5")}>
          <Link href="/dashboard" aria-label="EDGELOG home"><Logo collapsed={c} /></Link>
          {isMobile && <button onClick={onMobileClose} className="rounded-md p-1 text-muted hover:text-fg" aria-label={t.nav.closeMenu}><X className="size-5" /></button>}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section} className="mb-5">
              {!c && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{t.nav[group.section]}</p>}
              <ul className="space-y-0.5">
                {group.items.map(({ href, key, icon: Icon }) => {
                  const label = t.nav[key];
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        title={c ? label : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                          c && "justify-center px-0",
                          active ? "bg-elevated text-fg" : "text-fg-2 hover:bg-card hover:text-fg",
                        )}
                      >
                        {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-gold" />}
                        <Icon className={cn("size-[17px] shrink-0", active ? "text-gold" : "text-muted group-hover:text-fg-2")} />
                        {!c && <span>{label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {!isMobile && (
          <button onClick={toggle} className="flex h-12 items-center justify-center gap-2 border-t border-line/60 text-xs text-muted hover:text-fg" aria-label={c ? t.nav.expand : t.nav.collapse}>
            {c ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> {t.nav.collapse}</>}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 border-r border-line/60 bg-sidebar transition-[width] duration-200 lg:block", collapsed ? "w-[68px]" : "w-60")}>
        {content(false)}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-sidebar">{content(true)}</aside>
        </div>
      )}
    </>
  );
}
