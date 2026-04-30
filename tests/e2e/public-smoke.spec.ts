import { expect, test } from "@playwright/test";

test("login page renders and exposes Google auth provider", async ({ page, request }) => {
  await page.goto("/login");

  await expect(page.getByText("Node")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();

  const providers = await request.get("/api/auth/providers");
  expect(providers.ok()).toBe(true);
  const body = await providers.json();
  expect(body.google?.callbackUrl).toContain("/api/auth/callback/google");
});

test("root redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
