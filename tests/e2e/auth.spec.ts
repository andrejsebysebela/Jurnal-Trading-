import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/**
 * Password reset via the token-hash link (/auth/confirm). Needs a LOCAL Supabase admin key to mint the
 * recovery link without an inbox: E2E_SUPABASE_URL + E2E_SUPABASE_SERVICE_KEY. Never point this at production.
 */
const url = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.E2E_SUPABASE_SERVICE_KEY;

test("forgot password page never reveals whether an email exists", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(`nobody+${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();
});

test("reset page requires a recovery session", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login|\/forgot-password/);
});

test("invalid email links are rejected safely", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=recovery&next=//evil.com");
  await expect(page).toHaveURL(/\/login\?error=link/);
  await expect(page.getByText("That link is invalid or has expired")).toBeVisible();
});

test("password reset via recovery link", async ({ page }) => {
  test.skip(!serviceKey || /supabase\.co/.test(url), "needs a local Supabase service key");
  const email = `reset+${Date.now()}@example.com`;
  const admin = createClient(url, serviceKey!, { auth: { persistSession: false } });
  await admin.auth.admin.createUser({ email, password: "oldpassword1", email_confirm: true });
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  expect(error).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill("newpassword2");
  await page.getByLabel("Confirm new password").fill("newpassword2");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL("**/dashboard**");
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await page.fill("#email", email);
  await page.fill("#password", "oldpassword1");
  await page.click("button[type=submit]");
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await page.fill("#password", "newpassword2");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
});
