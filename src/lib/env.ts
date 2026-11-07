/**
 * Environment configuration. Only NEXT_PUBLIC_* values are used by the app;
 * the Supabase service-role key is NEVER read by application code.
 */
function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable ${name}. See .env.example and docs/DEPLOYMENT.md.`);
  }
  return value.trim();
}

export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Canonical public URL of the app (e.g. https://app.example.com), used for auth
 * email links. Falls back to Vercel's production/preview URL, then localhost in dev.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelProd = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  const vercel = vercelProd ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "production") {
    // Never emit localhost links from a production build.
    throw new Error("NEXT_PUBLIC_SITE_URL must be set for production builds outside Vercel.");
  }
  return "http://localhost:3000";
}

export const isHttps = () => siteUrl().startsWith("https://");

/** Same-origin relative path guard for ?next= redirects (prevents open redirects). */
export function safeRedirectPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
