import { afterEach, describe, expect, it, vi } from "vitest";
import { safeRedirectPath, siteUrl } from "./env";

describe("env", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com/");
    expect(siteUrl()).toBe("https://app.example.com");
  });
  it("falls back to the Vercel production URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "edgelog.vercel.app");
    expect(siteUrl()).toBe("https://edgelog.vercel.app");
  });
  it("refuses to fall back to localhost in production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
  it("blocks open redirects", () => {
    expect(safeRedirectPath("/trades?x=1")).toBe("/trades?x=1");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });
});
