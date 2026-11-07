import type { CookieOptionsWithName } from "@supabase/ssr";
import { isHttps } from "@/lib/env";

/** Auth cookies: Secure on HTTPS deployments, Lax to allow email-link navigation. */
export const authCookieOptions = (): CookieOptionsWithName => ({ path: "/", sameSite: "lax", secure: isHttps() });
