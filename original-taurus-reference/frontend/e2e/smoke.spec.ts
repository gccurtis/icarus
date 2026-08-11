import { test, expect, request } from '@playwright/test';

const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

// The stack is confirmed up by webServer.url (/api/healthz), so one register
// call suffices. A fresh Omega DB has no accounts; 409 means it already exists
// (idempotent), so both 201 and 409 are success.
test.beforeAll(async () => {
  const ctx = await request.newContext({
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true
  });
  const res = await ctx.post('/api/auth/register', { data: DEV });
  expect([201, 409]).toContain(res.status());
  await ctx.dispose();
});

test('signing in lands on the projects screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: 'e2e/screenshots/login.png', fullPage: true });

  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/projects/);
  await page.screenshot({ path: 'e2e/screenshots/projects.png', fullPage: true });
});
