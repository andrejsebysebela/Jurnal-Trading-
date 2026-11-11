import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { authCookieOptions } from "./cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/signup", "/forgot-password", "/auth/"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  // "/" is the public landing page (exact match only).
  const isPublic = path === "/" || PUBLIC.some((p) => path.startsWith(p));
  if (!user && path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/signup" || path === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
