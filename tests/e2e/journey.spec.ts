import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Simplified journal journey against the running app + local Supabase (profile timezone = UTC).
 * Every money value asserted below is computed by hand in the comments.
 */
const email = `e2e+${Date.now()}@example.com`;
const shots = process.env.E2E_SCREENSHOTS;

async function noAppError(page: Page) {
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
}

async function addTrade(page: Page, v: { account: string; pair: string; dir: "Long" | "Short"; open: string; close: string; risk: string; result: string; rr?: string; emotion?: string; notes?: string; tv?: string; file?: string }) {
  await page.goto("/trades/new");
  await page.getByLabel("Account *").selectOption({ label: v.account });
  await page.getByLabel("Pair *").fill(v.pair);
  await page.getByRole("button", { name: v.dir, exact: true }).click();
  await page.getByLabel("Open date & time *").fill(v.open);
  await page.getByLabel("Close date & time *").fill(v.close);
  await page.getByLabel(/^Amount risked/).fill(v.risk);
  await page.getByLabel(/^Result \(/).fill(v.result);
  if (v.rr) await page.getByLabel("Planned RR (1:x)").fill(v.rr);
  if (v.emotion) await page.getByRole("button", { name: v.emotion, exact: true }).click();
  if (v.notes) await page.getByLabel("Notes").fill(v.notes);
  if (v.tv) await page.getByLabel("TradingView link").fill(v.tv);
  if (v.file) await page.getByTestId("screenshot-input").setInputFiles(v.file);
}

test.describe.configure({ mode: "serial" });

test("simple journal: accounts → trades → statistics → Slovak", async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/signup");
  await page.fill("#displayName", "Alex Trader");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();

  // Accounts: prop firm (verification) + personal (live)
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).first().click();
  await page.getByLabel("Name").fill("FTMO 100k");
  await page.getByRole("button", { name: "Verification" }).click();
  await page.getByLabel("Prop firm", { exact: true }).fill("FTMO");
  await page.getByRole("textbox", { name: "Starting balance" }).fill("100000");
  await page.getByLabel("Profit target").fill("10000");
  await page.getByLabel("Max daily loss").fill("5000");
  await page.getByLabel("Max total drawdown").fill("10000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("account-card")).toHaveCount(1);
  await expect(page.getByTestId("account-card")).toContainText("Verification");

  await page.getByRole("button", { name: "New account" }).first().click();
  await page.getByLabel("Name").fill("Personal");
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await page.getByRole("textbox", { name: "Starting balance" }).fill("5000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("account-card")).toHaveCount(2);

  // Dark dropdown options (bug: white-on-white option lists on Windows)
  await page.goto("/trades/new");
  const opt = await page.locator("select option").nth(1).evaluate((o) => [getComputedStyle(o).backgroundColor, getComputedStyle(o).color]);
  expect(opt).toEqual(["rgb(20, 25, 34)", "rgb(245, 245, 245)"]); // dark background, light text

  // Validation: bad TradingView link + close before open
  await addTrade(page, { account: "FTMO 100k (USD)", pair: "eurusd", dir: "Long", open: "2026-11-05T09:00", close: "2026-11-05T08:00", risk: "100", result: "250", tv: "https://evil.example.com/x" });
  await page.getByRole("button", { name: "Save trade" }).click();
  await expect(page.getByText("Only https://…tradingview.com links are allowed")).toBeVisible();
  await expect(page.getByText("Close time is before open time")).toBeVisible();

  // Trade 1 (FTMO): +250 on 100 risk → +2.50R, 1:2.5, 2 h 30 m, screenshot + TradingView
  await addTrade(page, { account: "FTMO 100k (USD)", pair: "eurusd", dir: "Long", open: "2026-11-05T09:00", close: "2026-11-05T11:30", risk: "100", result: "250", rr: "2.5", emotion: "Calm", notes: "Clean breakout retest.", tv: "https://www.tradingview.com/x/abc123/", file: path.join(__dirname, "fixtures/chart.png") });
  await expect(page.getByTestId("trade-preview")).toContainText("+2.50R");
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/\/trades\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "EURUSD" })).toBeVisible();
  const ov = page.getByLabel("Preview");
  await expect(ov).toContainText("+$250.00");
  await expect(ov).toContainText("+2.50R");
  await expect(ov).toContainText("1:2.5");
  await expect(ov).toContainText("2 h 30 m");
  await expect(ov).toContainText("Calm");
  await expect(page.getByRole("link", { name: "Open on TradingView" })).toHaveAttribute("href", "https://www.tradingview.com/x/abc123/");
  const img = page.getByRole("img", { name: "Screenshots" });
  await expect(img).toBeVisible();
  expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  await expect(page.getByText("Clean breakout retest.")).toBeVisible();

  // Trade 2 (FTMO): short, -200 on 200 risk → -1.00R (later edited)
  await addTrade(page, { account: "FTMO 100k (USD)", pair: "XAUUSD", dir: "Short", open: "2026-11-06T14:00", close: "2026-11-06T14:45", risk: "200", result: "-200", emotion: "FOMO" });
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/\/trades\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Preview")).toContainText("-1.00R");
  // Edit: result -200 → -100 (decimal comma accepted) → -0.50R
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel(/^Result \(/).fill("-100,00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/trades\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Preview")).toContainText("-$100.00");
  await expect(page.getByLabel("Preview")).toContainText("-0.50R");

  // Trade 3 (Personal): breakeven
  await addTrade(page, { account: "Personal (USD)", pair: "EURUSD", dir: "Long", open: "2026-11-06T09:00", close: "2026-11-06T10:00", risk: "50", result: "0" });
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/\/trades\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Preview")).toContainText("0.00R");
  await expect(page.locator("main").getByText("Breakeven", { exact: true }).first()).toBeVisible();

  // All accounts: net = 250 - 100 + 0 = +$150.00 ; win rate 1/(1+1) = 50.0% ; avg R = (2.5 - 0.5 + 0) / 3 = +0.67R
  await page.goto("/dashboard");
  await expect(page.getByTestId("kpi-net")).toContainText("+$150.00");
  await expect(page.getByTestId("kpi-winrate")).toContainText("50.0%");
  await expect(page.getByTestId("kpi-avgr")).toContainText("+0.67R");
  await expect(page.getByTestId("dashboard-account")).toHaveCount(2);
  if (shots) await page.screenshot({ path: `${shots}/dashboard-en.png`, fullPage: true });

  // Per-account statistics: FTMO only → net +$150.00, avg R (2.5 - 0.5)/2 = +1.00R
  await page.goto("/accounts");
  await page.getByTestId("account-card").filter({ hasText: "FTMO 100k" }).getByRole("button", { name: "Statistics" }).click();
  await page.waitForURL("**/statistics");
  await expect(page.getByTestId("account-picker")).toContainText("FTMO 100k");
  await expect(page.getByTestId("kpi-net")).toContainText("+$150.00");
  await expect(page.getByTestId("kpi-avgr")).toContainText("+1.00R");
  await expect(page.getByRole("heading", { name: "By pair" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/statistics-en.png`, fullPage: true });
  // Personal only → net $0.00 breakeven
  await page.getByTestId("account-picker").click();
  await page.getByRole("menuitem", { name: /^Personal/ }).click();
  await expect(page.getByTestId("kpi-net")).toContainText("$0.00");
  await page.getByTestId("account-picker").click();
  await page.getByRole("menuitem", { name: "All accounts" }).click();
  await expect(page.getByTestId("kpi-net")).toContainText("+$150.00");

  // Trades table: filter + bulk delete
  await page.goto("/trades");
  await expect(page.getByTestId("trade-row")).toHaveCount(3);
  await page.getByLabel("Pair", { exact: true }).selectOption("XAUUSD");
  await expect(page.getByTestId("trade-row")).toHaveCount(1);
  await page.getByLabel("Pair", { exact: true }).selectOption("");
  await page.getByTestId("trade-row").filter({ hasText: "Breakeven" }).count();
  if (shots) await page.screenshot({ path: `${shots}/trades-en.png`, fullPage: true });

  for (const route of ["/dashboard", "/trades", "/calendar?month=2026-11", "/calendar/2026-11-05", "/statistics", "/accounts", "/settings"]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await noAppError(page);
  }

  // Slovak
  await page.goto("/dashboard");
  await page.getByRole("group", { name: "Language" }).first().getByRole("button", { name: "sk" }).click();
  await expect(page.getByRole("link", { name: "Prehľad" })).toBeVisible();
  await expect(page.getByTestId("kpi-net")).toContainText(/\+150,00\sUSD/);
  await expect(page.getByTestId("kpi-winrate")).toContainText(/50,0\s%/);
  if (shots) await page.screenshot({ path: `${shots}/dashboard-sk.png`, fullPage: true });
  await page.goto("/trades/new");
  await expect(page.getByRole("heading", { name: "Pridať obchod" })).toBeVisible();
  await expect(page.getByLabel("Riskovaná suma (USD) *")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/trade-form-sk.png`, fullPage: true });
  for (const route of ["/trades", "/calendar?month=2026-11", "/statistics", "/accounts", "/settings"]) {
    await page.goto(route);
    await noAppError(page);
  }
  await page.goto("/statistics");
  await expect(page.getByRole("heading", { name: "Podľa páru" })).toBeVisible();

  // Bulk delete (Slovak UI)
  await page.goto("/trades");
  await page.getByLabel("Vybrať všetko").check();
  await page.getByRole("button", { name: "Vymazať", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Vymazať" }).click();
  await expect(page.getByText("V tomto období nie sú žiadne obchody")).toBeVisible();
  // back to English for other tests in this browser context
  await page.getByRole("group", { name: "Jazyk" }).first().getByRole("button", { name: "en" }).click();
  expect(errors).toEqual([]);
});

test("unauthenticated users are redirected and cannot read data", async ({ page, request }) => {
  await page.goto("/trades");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrades/);
  const res = await request.get("/api/export");
  expect(res.status()).toBe(401);
});
