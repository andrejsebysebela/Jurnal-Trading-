import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-14 text-center", className)}>
      {Icon && <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-elevated"><Icon className="size-5 text-gold" /></div>}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
