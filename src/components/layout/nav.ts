import {
  BarChart3, BookOpen, CalendarDays, ClipboardList, Gauge, LayoutDashboard, LineChart, NotebookPen, Settings, Target,
  TrendingUp, Upload, Wallet, Layers, Shapes,
} from "lucide-react";

export const NAV = [
  { section: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/trades", label: "Trades", icon: Layers },
  ] },
  { section: "Analysis", items: [
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/performance", label: "Performance", icon: LineChart },
    { href: "/instruments", label: "Instruments", icon: Shapes },
    { href: "/strategies", label: "Strategies", icon: Target },
  ] },
  { section: "Journal", items: [
    { href: "/journal", label: "Daily Journal", icon: NotebookPen },
    { href: "/notes", label: "Trade Notes", icon: BookOpen },
    { href: "/playbook", label: "Playbook", icon: ClipboardList },
    { href: "/progress", label: "Progress Tracker", icon: TrendingUp },
  ] },
  { section: "Management", items: [
    { href: "/accounts", label: "Accounts", icon: Wallet },
    { href: "/import", label: "Import Trades", icon: Upload },
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
] as const;

export const LogoIcon = Gauge;
