import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS } from "./columns";
import type { Profile } from "./types";

/** Authenticated context for server components & actions. Redirects to /login if signed out. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single<Profile>();
  return {
    supabase,
    user,
    profile: profile ?? ({ id: user.id, display_name: null, timezone: "UTC", base_currency: "USD", matching_policy: "fifo", breakeven_tolerance: "0", fx_max_stale_days: 0, onboarded: false } satisfies Profile),
  };
});

export type UserContext = Awaited<ReturnType<typeof requireUser>>;
