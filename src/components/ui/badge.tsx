import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badge = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", {
  variants: {
    tone: {
      neutral: "bg-elevated text-fg-2 border border-line",
      profit: "bg-profit/12 text-profit",
      loss: "bg-loss/12 text-loss",
      gold: "bg-gold/12 text-gold",
      warning: "bg-amber-500/12 text-amber-400",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
