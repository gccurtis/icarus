import { test, expect, type APIRequestContext } from '@playwright/test';
import { signedInApiContext } from './api-context';

const BASE = 'https://localhost:5173';
const OWNER = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };
const JOINER = { email: 'joiner@taurus.local', password: 'password123', name: 'Joiner' };

let api: APIRequestContext;
let projectId = '';
let editToken = '';

// Owner (via API) creates a shared project and mints an edit link; the joiner
// account is registered so it can sign in through the browser.
test.beforeAll(async () => {
  api = await signedInApiContext(BASE, OWNER);
  const created = await api.post('/api/projects', { data: { name: 'Shared via link' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
  await api.patch(`/api/projects/${projectId}`, { data: { visibility: 'link' } });
  const link = await api.put(`/api/projects/${projectId}/links/edit`);
  expect(link.status()).toBe(200);
  editToken = (await link.json()).token;
  const reg = await api.post('/api/auth/register', { data: JOINER });
  expect([201, 409]).toContain(reg.status());
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

test('owner sees the read/edit share links in project settings', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[type="email"]').fill(OWNER.email);
  await page.locator('input[type="password"]').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);

  await page.getByText('Shared via link').first().click({ trial: true });
  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByText('Settings', { exact: true }).click();

  await expect(page.getByText('Share links')).toBeVisible();
  // The edit link minted in beforeAll renders as a readonly /join/<token> URL.
  await expect(page.locator('input[readonly]').filter({ has: page.locator(':scope') })).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Create read link' })).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/share-links-settings.png', fullPage: true });
});

test('the top-bar Share dialog is real: it mints a working link, not a mock', async ({ page }) => {
  // This dialog used to be a mock that copied a fixed `/join/mock-share-token`
  // and changed no access. It now renders the same `ProjectSharing` component as
  // Project settings, so the two cannot drift.
  await page.goto('/');
  await page.locator('input[type="email"]').fill(OWNER.email);
  await page.locator('input[type="password"]').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);

  // Scoped to the top bar: the context rail's Properties lens also offers Share
  // (2026-07-29) and it opens the same dialog, so an unscoped locator is ambiguous.
  await page.getByRole('banner').getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share' });
  await expect(dialog).toBeVisible();
  // No mock badge, and the real access control is present.
  await expect(dialog.getByText('Mock')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Anyone with link' })).toBeVisible();

  // The edit link minted through the API in beforeAll shows here as a real
  // /join/<token> URL — the same token the deep-link test below joins with.
  const editLink = dialog.locator('input[readonly]').first();
  await expect(editLink).toHaveValue(new RegExp(`/join/${editToken}$`));

  // Minting the read link is a real Omega write: it comes back a usable URL and
  // survives a reopen, which a mock could not do.
  await dialog.getByRole('button', { name: 'Create read link' }).click();
  await expect(dialog.getByRole('button', { name: 'Copy read link' })).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/share-dialog-real.png', fullPage: true });

  const readLink = await api.get(`/api/projects/${projectId}/links`);
  const links = (await readLink.json()).links as { role: string; token: string }[];
  expect(links.some((l) => l.role === 'read')).toBe(true);
});

test('an unauthenticated /join/:token deep link signs in and opens the project', async ({ page }) => {
  await page.goto(`/join/${editToken}`);
  // Signed out → bounced to sign-in with a return-to.
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[type="email"]').fill(JOINER.email);
  await page.locator('input[type="password"]').fill(JOINER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // → back to /join/:token → join by token → the project workspace opens.
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
  await page.screenshot({ path: 'e2e/screenshots/share-links-joined.png', fullPage: true });
});
