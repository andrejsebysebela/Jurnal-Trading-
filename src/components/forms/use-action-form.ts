"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/server/actions/result";

/** Submit a react-hook-form through a server action, mapping server field errors back. */
export function useActionSubmit<T extends FieldValues, R>(form: UseFormReturn<T>, action: (v: T) => Promise<ActionResult<R>>, opts: { success?: string | ((r: R) => string); onSuccess?: (r: R) => void } = {}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const submit = form.handleSubmit((values) =>
    start(async () => {
      const res = await action(values);
      if (!res.ok) {
        Object.entries(res.fieldErrors ?? {}).forEach(([k, msg]) => form.setError(k as Path<T>, { message: msg }));
        toast.error(res.error);
        return;
      }
      const data = (res as { data: R }).data;
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(data) : opts.success);
      opts.onSuccess?.(data);
      router.refresh();
    }),
  );
  return { submit, pending };
}
