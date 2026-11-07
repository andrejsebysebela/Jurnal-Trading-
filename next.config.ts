import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV imports are sent to a server action; allow files up to ~10 MB.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
