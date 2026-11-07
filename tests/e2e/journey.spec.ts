import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Full user journey against a running app + local Supabase (`pnpm db:start`).
 * Verifies real persistence and server-side calculations end to end.
 */
const email = `e2e+${Date.now()}@example.com`;
const shots = process.env.E2E_SCREENSHOTS;

async function noAppError(page: Page) {
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
}

test.describe.configure({ mode: "serial" });

test("trader journey: account → trade → instrument spec → import → analytics", async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Sign up
  await page.goto("/signup");
  await page.fill("#displayName", "Alex Trader");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Create an account")).toBeVisible();

  // Account
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.fill("input[name=name]", "Main");
  await page.selectOption("select[name=accountType]", "prop");
  await page.fill("input[name=startingBalance]", "100000");
  await page.fill("input[name=profitTarget]", "10000");
  await page.fill("input[name=maxDailyLoss]", "5000");
  await page.fill("input[name=maxTotalDrawdown]", "10000");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByTestId("account-card")).toHaveCount(1);

  // Validation: invalid trade rejected
  await page.goto("/trades/new");
  await page.getByRole("button", { name: "Save trade" }).click();
  await expect(page.getByText("Symbol is required")).toBeVisible();

  // Manual trade with partial exits
  await page.fill("input[name=symbol]", "EURUSD");
  await page.fill("input[name=quoteCurrency]", "USD");
  const rows = page.getByTestId("exec-row");
  const fill = async (i: number, q: string, p: string, t: string, c: string) => {
    await rows.nth(i).getByLabel("Quantity").fill(q);
    await rows.nth(i).getByLabel("Price").fill(p);
    await rows.nth(i).getByLabel("Execution time").fill(t);
    await rows.nth(i).getByLabel("Commission").fill(c);
  };
  await fill(0, "1", "1.10000", "2026-11-05T09:00", "3.5");
  await fill(1, "0.5", "1.10500", "2026-11-05T10:00", "1.75");
  await page.getByRole("button", { name: "Exit" }).click();
  await fill(2, "0.5", "1.10300", "2026-11-05T11:00", "1.75");
  await page.fill("input[name=stopLoss]", "1.09500");
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/\/trades\/[0-9a-f-]{36}$/);
  const tradeUrl = page.url();
  // No contract size configured → never guessed
  await expect(page.getByText("contract size (units per lot) is not configured")).toBeVisible();
  await expect(page.getByLabel("Overview").getByText("Unavailable")).toBeVisible();

  // Configure instrument → automatic recalculation
  await page.goto("/instruments");
  await page.getByRole("button", { name: "Edit EURUSD" }).click();
  await page.fill("input[name=contractSize]", "100000");
  await expect(page.getByText("1.0 price move × 1 quantity =")).toBeVisible();
  await page.getByRole("button", { name: "Save & mark reviewed" }).click();
  await expect(page.getByText(/1 trade\(s\) recalculated/)).toBeVisible();

  // gross = 0.005*0.5*100000 + 0.003*0.5*100000 = 250 + 150 = 400; fees 7 → net 393; risk 0.005*1*100000=500 → R 0.786
  await page.goto(tradeUrl);
  const overview = page.getByLabel("Overview");
  await expect(overview).toContainText("+$393.00");
  await expect(overview).toContainText("+$400.00");
  await expect(overview).toContainText("+0.79R");
  await expect(overview).toContainText("$500.00");

  // Screenshot upload to private storage (direct browser → Supabase, allowed by CSP) and deletion
  await page.getByTestId("screenshot-input").setInputFiles(path.join(__dirname, "fixtures/chart.png"));
  const shot = page.getByRole("img", { name: "before screenshot" });
  await expect(shot).toBeVisible();
  expect(await shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete screenshot" }).click();
  await expect(page.getByText("No screenshots yet.")).toBeVisible();

  // Inline note autosave
  await page.getByLabel("What I learned").fill("Partial exits reduced variance.");
  await page.getByLabel("What I did well").click();
  await expect(page.getByText("Saving…")).toHaveCount(0);

  // Import executions CSV (futures)
  await page.goto("/import");
  await page.getByTestId("csv-input").setInputFiles(path.join(__dirname, "fixtures/es-executions.csv"));
  await expect(page.getByText("3 · Preview")).toBeVisible();
  await expect(page.getByText(/2 trade\(s\) from 5 rows/)).toBeVisible();
  await page.getByLabel("Asset class for ES").selectOption("futures");
  await page.getByRole("button", { name: /Import 2 trade/ }).click();
  await expect(page.getByTestId("import-summary")).toContainText("New trades2");

  // Re-import → duplicates skipped
  await page.getByRole("button", { name: "Import another file" }).click();
  await page.getByTestId("csv-input").setInputFiles(path.join(__dirname, "fixtures/es-executions.csv"));
  await page.getByRole("button", { name: /Import 2 trade/ }).click();
  await expect(page.getByTestId("import-summary")).toContainText("Duplicates skipped2");

  // Configure ES point value → recalc: trade1 = 262.5+487.5-4.2 = 745.8 ; trade2 short = (5012-5020)*2*50 - 4.2 = -804.2
  await page.goto("/instruments");
  await page.getByRole("button", { name: "Edit ES" }).click();
  await page.fill("input[name=pointValue]", "50");
  await page.getByRole("button", { name: "Save & mark reviewed" }).click();
  await expect(page.getByText(/2 trade\(s\) recalculated/)).toBeVisible();

  // Dashboard KPIs: net = 393 + 745.8 - 804.2 = 334.6
  await page.goto("/dashboard");
  await expect(page.getByTestId("kpi-net")).toContainText("+$334.60");
  await expect(page.getByTestId("kpi-winrate")).toContainText("66.7%");
  if (shots) await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });

  // Strategy
  await page.goto("/strategies");
  await page.getByRole("button", { name: "New strategy" }).first().click();
  await page.fill("input[name=name]", "Opening Range Breakout");
  await page.getByPlaceholder("e.g. Higher-timeframe trend aligned").fill("Above VWAP");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save strategy" }).click();
  await expect(page.getByRole("heading", { name: "Opening Range Breakout" })).toBeVisible();

  // Bulk assign strategy + tag on trades table
  await page.goto("/trades");
  await expect(page.getByTestId("trade-row")).toHaveCount(3);
  await page.getByLabel("Select all").check();
  await page.getByRole("button", { name: "Bulk edit" }).click();
  await page.getByLabel("Add tags").fill("A+ setup");
  await page.getByLabel("Strategy").selectOption({ label: "Opening Range Breakout" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Trades updated")).toBeVisible();
  await expect(page.getByTestId("trade-row").first()).toContainText("Opening Range Breakout");

  // Rules + journal
  await page.goto("/playbook");
  await page.getByLabel("New rule").fill("Max 3 trades per day");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByText("Max 3 trades per day")).toBeVisible();
  await page.goto("/calendar/2026-11-05");
  await expect(page.getByRole("heading", { name: "Daily journal" })).toBeVisible();
  await page.getByLabel("Pre-market plan").fill("Trade only A+ setups.");
  await page.getByRole("button", { name: "Save journal" }).click();
  await expect(page.getByText("Journal saved")).toBeVisible();

  // Every page renders without errors
  for (const route of ["/dashboard", "/calendar?month=2026-11", "/trades", "/reports", "/performance", "/instruments", "/strategies", "/journal?date=2026-11-05", "/notes", "/playbook", "/progress", "/accounts", "/import", "/settings"]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await noAppError(page);
    if (shots) await page.screenshot({ path: `${shots}/${route.slice(1).replace(/[/?=]/g, "_")}.png`, fullPage: true });
  }
  await page.goto("/notes");
  await expect(page.getByText("Partial exits reduced variance.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("unauthenticated users are redirected and cannot read data", async ({ page, request }) => {
  await page.goto("/trades");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrades/);
  const res = await request.get("/api/export");
  expect(res.status()).toBe(401);
});
