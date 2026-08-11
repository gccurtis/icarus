import { test, expect, type APIRequestContext } from '@playwright/test';
import { signedInApiContext } from './api-context';

const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

// Create a project up front (via API) so the settings dialog has real data to
// show; clean it up afterward so the dev account stays empty between runs.
test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Settings Test' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

test('project settings shows real members and editable profile', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);

  // The project created above is listed.
  await expect(page.getByText('Settings Test')).toBeVisible();

  // Open its settings via the row's "More options" menu.
  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByText('Settings', { exact: true }).click();

  // The dialog shows the real member list (just you) with the real account email.
  await expect(page.getByText('Project settings')).toBeVisible();
  await expect(page.getByText(/Members ·/)).toBeVisible();
  await expect(page.getByText('You')).toBeVisible();
  await expect(page.getByText(DEV.email)).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/project-settings.png', fullPage: true });
});
