import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath, siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "recovery", "invite", "magiclink", "email_change", "email"];

/**
 * Token-hash verification (recommended Supabase email template links).
 * Works even when the email is opened in a different browser than the one that requested it.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const fallbackNext = type === "recovery" ? "/reset-password" : "/dashboard";
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), fallbackNext);
  const base = siteUrl();
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, base));
  }
  return NextResponse.redirect(new URL("/login?error=link", base));
}
