"use client";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils/cn";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...p }: T.TabsListProps) {
  return <T.List className={cn("flex gap-1 overflow-x-auto border-b border-line", className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: T.TabsTriggerProps) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-fg-2 transition-colors hover:text-fg data-[state=active]:border-gold data-[state=active]:text-fg",
        className,
      )}
      {...p}
    />
  );
}
