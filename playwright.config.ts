import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH || (process.env.CI ? undefined : "/opt/pw-browsers/chromium");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "off",
    // English UI by default (Accept-Language); the Slovak test switches language explicitly.
    locale: "en-US",
    timezoneId: "UTC",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm dev --port 3000", url: "http://127.0.0.1:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
