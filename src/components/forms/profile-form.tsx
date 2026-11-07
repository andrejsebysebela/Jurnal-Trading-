"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { Profile } from "@/lib/db/types";
import { useI18n } from "@/lib/i18n/client";
import { saveProfile } from "@/server/actions/management";

export function ProfileForm({ profile, timeZones }: { profile: Profile; timeZones: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ displayName: profile.display_name ?? "", timezone: profile.timezone, baseCurrency: profile.base_currency });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form className="grid gap-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveProfile(v);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      setErrors({}); toast.success(t.settings.saved); router.refresh();
    }); }}>
      <Field label={t.settings.displayName} error={errors.displayName}><Input value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} /></Field>
      <Field label={t.settings.timezone} error={errors.timezone} hint={t.settings.timezoneHint}>
        <Input list="tz-list" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
        <datalist id="tz-list">{timeZones.map((z) => <option key={z} value={z} />)}</datalist>
      </Field>
      <Field label={t.settings.baseCurrency} error={errors.baseCurrency} hint={t.settings.baseCurrencyHint}><Input value={v.baseCurrency} maxLength={3} className="uppercase" onChange={(e) => setV({ ...v, baseCurrency: e.target.value.toUpperCase() })} /></Field>
      <div className="flex justify-end md:col-span-3"><Button type="submit" variant="primary" disabled={pending}>{pending ? t.common.saving : t.common.save}</Button></div>
    </form>
  );
}
