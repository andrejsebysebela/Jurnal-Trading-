"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // NEXT_PUBLIC_* must be referenced literally so Next.js inlines them in the browser bundle.
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { path: "/", sameSite: "lax", secure: typeof window !== "undefined" && window.location.protocol === "https:" },
  });
}
