import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Supabase origin for CSP (REST, Auth, Storage uploads, signed image URLs). */
function supabaseOrigins(): string[] {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return [u.origin, `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`];
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
}

const sb = supabaseOrigins().join(" ");
// HTTPS-only directives are emitted only for real HTTPS deployments (not `pnpm start` on http://localhost).
const httpsDeployment = !isDev && ((process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ?? false) || !!process.env.VERCEL);
const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-eval' only in development (React refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${sb}`,
  "font-src 'self' data:",
  `connect-src 'self' ${sb}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(httpsDeployment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // CSV imports are sent to a server action (client caps files at 4 MB; Vercel caps bodies at 4.5 MB).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        ...(!httpsDeployment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    }];
  },
};

export default nextConfig;
