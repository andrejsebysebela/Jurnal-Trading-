import { cn } from "@/lib/utils/cn";

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#141922" stroke="#2c3442" />
        <path d="M8 21.5 13 16l4 3.5 7-9" fill="none" stroke="#C6A15B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="10.5" r="1.9" fill="#D8B56D" />
      </svg>
      {!collapsed && (
        <span className="text-[15px] font-semibold tracking-[0.22em] text-fg">
          EDGE<span className="text-gold">LOG</span>
        </span>
      )}
    </div>
  );
}
