"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";


export function ConfirmButton({ action, title, description, confirmLabel = "Delete", success, children, redirectTo, ...btn }: ButtonProps & {
  action: () => Promise<{ ok: boolean; error?: string }>; title: string; description: string; confirmLabel?: string; success?: string; redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button {...btn}>{children}</Button></DialogTrigger>
      <DialogContent title={title} description={description}>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => {
            const r = await action();
            if (!r.ok) { toast.error(r.error ?? "Something went wrong."); return; }
            if (success) toast.success(success);
            setOpen(false);
            if (redirectTo) router.push(redirectTo); else router.refresh();
          })}>{pending ? "Working…" : confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
