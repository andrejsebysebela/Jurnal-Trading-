import * as React from "react";
import { cn } from "@/lib/utils/cn";

const base =
  "w-full rounded-lg border border-line bg-[#0f131a] px-3 text-sm text-fg placeholder:text-muted transition-colors focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/30 disabled:opacity-50 aria-[invalid=true]:border-loss/70";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, "h-9", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-[88px] py-2 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(base, "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23657080%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.6rem_center] bg-no-repeat pr-8", className)} {...p}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-fg-2", className)} {...p} />;
}

/**
 * Form field. The control is wrapped in its <label> so the accessible name is
 * always associated (screen readers, getByLabel). Use `group` for fields that
 * contain several controls (e.g. a segmented button group).
 */
export function Field({ label, error, hint, children, className, htmlFor, group }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string; htmlFor?: string; group?: boolean }) {
  const text = <span className="mb-1.5 block text-xs font-medium text-fg-2">{label}</span>;
  return (
    <div className={className}>
      {group || htmlFor ? (
        <>
          {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <div role="group" aria-label={label}>{text}{children}</div>}
          {htmlFor && children}
        </>
      ) : (
        <label className="block">{text}{children}</label>
      )}
      {error ? <p className="mt-1 text-xs text-loss" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
