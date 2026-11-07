import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath, siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** PKCE code exchange for email confirmation, password recovery and OAuth. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const base = siteUrl();
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, base));
  }
  return NextResponse.redirect(new URL("/login?error=link", base));
}
