"use client";
import * as M from "@radix-ui/react-dropdown-menu";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Dropdown = M.Root;
export const DropdownTrigger = M.Trigger;

export function DropdownContent({ className, children, align = "end" }: { className?: string; children: React.ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn("z-50 min-w-[180px] rounded-xl border border-line bg-elevated p-1 shadow-xl shadow-black/40", className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function DropdownItem({ className, danger, ...p }: M.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none [&_svg]:size-4",
        danger ? "text-loss data-[highlighted]:bg-loss/10" : "text-fg-2 data-[highlighted]:bg-card data-[highlighted]:text-fg",
        className,
      )}
      {...p}
    />
  );
}

export function DropdownCheckbox({ className, ...p }: M.DropdownMenuCheckboxItemProps) {
  return (
    <M.CheckboxItem
      onSelect={(e) => e.preventDefault()}
      className={cn("flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-fg-2 outline-none data-[highlighted]:bg-card data-[highlighted]:text-fg", className)}
      {...p}
    >
      <span className="flex size-3.5 items-center justify-center rounded-sm border border-line data-[state=checked]:bg-gold">
        <M.ItemIndicator className="size-2 rounded-[2px] bg-gold" />
      </span>
      {p.children}
    </M.CheckboxItem>
  );
}

export const DropdownSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
export const DropdownLabel = ({ children }: { children: React.ReactNode }) => (
  <M.Label className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</M.Label>
);
