import { BarChart3, CalendarDays, Layers, LayoutDashboard, Settings, Wallet } from "lucide-react";

export const NAV = [
  { section: "journal", items: [
    { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
    { href: "/trades", key: "trades", icon: Layers },
    { href: "/calendar", key: "calendar", icon: CalendarDays },
    { href: "/statistics", key: "statistics", icon: BarChart3 },
  ] },
  { section: "management", items: [
    { href: "/accounts", key: "accounts", icon: Wallet },
    { href: "/settings", key: "settings", icon: Settings },
  ] },
] as const;
