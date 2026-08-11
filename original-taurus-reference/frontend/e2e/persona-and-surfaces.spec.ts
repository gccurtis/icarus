import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { signedInApiContext } from './api-context';

// Exercises the surfaces changed in the 2026-07-27 pass: the Overview "All resources"
// header with Import/Export buttons (mock modals), the top-bar Share modal (mock), the
// Notifications-free user settings, and per-chat personas (the picker sets the chat's
// persona, applied to the chat the first turn creates).
//
// The per-chat persona test needs an Omega with the `PATCH /agent/chats/:id/persona`
// route (per-chat persona). An older running binary 404s it, in which case the chat is
// created without a persona and the final assertion fails — restart Omega to pick it up.
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';
let editorPersonaId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Persona + Surfaces Test' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;

  // Seed a second, non-default persona so the picker has something to switch to.
  await api.post('/api/session/project', { data: { projectId } });
  const persona = await api.post('/api/personas', {
    data: {
      name: 'E2E Editor',
      description: 'Seeded by the e2e persona test.',
      definition: {
        focus: 'editing',
        behavioralGuidance: 'Be concise.',
        contextReferences: [],
        defaultVerification: '',
        outputPreferences: ''
      }
    }
  });
  expect(persona.status()).toBe(201);
  editorPersonaId = (await persona.json()).persona.id;
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

async function signIn(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
}

test('changed surfaces: All resources import/export, Share modal, Notifications-free settings', async ({
  page
}) => {
  await signIn(page);

  // Overview: the resources section is now titled "All resources".
  await expect(page.getByText('All resources', { exact: true })).toBeVisible();

  // Import + Export are two buttons in the table header (scoped to the resources
  // section so they don't collide with the top-bar import/export controls).
  const resources = page.locator('section').filter({ hasText: 'All resources' });
  await resources.getByRole('button', { name: 'Import' }).click();
  const importDialog = page.getByRole('dialog', { name: 'Import' });
  await expect(importDialog).toBeVisible();
  await expect(importDialog.getByText('Mock', { exact: true })).toBeVisible();
  await importDialog.getByRole('button', { name: 'Cancel' }).click();

  // Export is REAL now: it downloads each document's actual content through the
  // per-kind transfer table, so the Mock badge is gone. It offers the same four
  // formats as the editor's Export menu and the row Download menu (one shared
  // table), with the three that have no serializer marked in their own label.
  // The table's bulk control is labelled "Download" now, matching the row menus
  // — `.first()` because the header button precedes the per-row ones in the DOM.
  await resources.getByRole('button', { name: 'Download' }).first().click();
  const exportDialog = page.getByRole('dialog', { name: 'Export selected' });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByText('Mock', { exact: true })).toHaveCount(0);
  await expect(exportDialog.getByText('Markdown (.md)')).toBeVisible();
  await expect(exportDialog.getByText(/downloads the real content/i)).toBeVisible();
  await exportDialog.getByRole('button', { name: 'Cancel' }).click();
  await page.screenshot({ path: 'e2e/screenshots/persona-all-resources.png', fullPage: true });

  // Top bar: Share is REAL as of workstream E — it renders the same
  // `ProjectSharing` component as Project settings, so no mock badge and no
  // "isn't wired yet" copy. `share-links.spec.ts` owns the deeper assertions
  // (that a link minted here actually comes back from the API).
  // Scoped to the top bar: the context rail's Properties lens also offers Share
  // (2026-07-29), mounting the same dialog, so an unscoped locator matches both.
  await page.getByRole('banner').getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Share' });
  await expect(shareDialog).toBeVisible();
  await expect(shareDialog.getByText('Mock', { exact: true })).toHaveCount(0);
  await expect(shareDialog.getByText(/Sharing isn.t wired yet/)).toHaveCount(0);
  await expect(shareDialog.getByRole('button', { name: 'Anyone with link' })).toBeVisible();
  await shareDialog.getByRole('button', { name: 'Done' }).click();

  // User settings: real profile + theme, and no Notifications section.
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByText('User settings', { exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'User settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByText('Theme', { exact: true })).toBeVisible();
  await expect(settings.getByText('Notifications')).toHaveCount(0);
  await expect(settings.getByText('Email notifications')).toHaveCount(0);
  await page.screenshot({
    path: 'e2e/screenshots/persona-settings-no-notifications.png',
    fullPage: true
  });
});

test('per-chat persona: the picker sets the chat the first turn creates', async ({ page }) => {
  // Raised on ARITHMETIC, not because it failed — that distinction is the rule
  // here. This test's own inner waits already budget 60s (15s picker + 15s chat
  // + 30s agent reply) inside Playwright's 30s per-test default, so it could
  // time out while its assertions were still legitimately waiting; at 30s it was
  // unpassable regardless of whether the app worked. It also waits on a REAL
  // model call, and Omega's provider timeout alone is 60s.
  //
  // A raised budget is only ever correct when the work genuinely takes that
  // long. If a test that should be fast starts timing out, that is a hang to
  // diagnose — see the note in session-expiry.spec.ts, where raising the budget
  // was the wrong call and got reverted.
  test.setTimeout(150_000);
  await signIn(page);
  // Reload so the project session is settled before the dock loads personas.
  await page.reload();

  // The composer's persona picker offers the managed General plus the seeded Editor.
  const picker = page.getByLabel('Chat persona');
  await expect(picker).toBeVisible({ timeout: 15000 });
  await expect(picker.getByRole('option', { name: 'E2E Editor' })).toHaveCount(1);

  // Pick the editor persona before sending — the chat the first turn creates adopts it
  // (a non-default pick is PATCHed onto the new chat before the turn).
  await picker.selectOption({ label: 'E2E Editor' });
  const prompt = page.getByRole('textbox', { name: 'AI Agent prompt' });
  await prompt.fill('Ping from the editor persona.');
  await prompt.press('Enter');
  await expect(page.getByText('Ping from the editor persona.').first()).toBeVisible();

  // The created chat carries the editor persona (queried via the browser's own session
  // so the active project matches). Requires Omega's per-chat persona route.
  await expect
    .poll(
      async () => {
        const res = await page.request.get('/api/agent/chats');
        const body = await res.json();
        return (body.chats ?? []).find((c: { title?: string }) => c.title?.startsWith('Ping'))
          ?.personaId;
      },
      { timeout: 15000 }
    )
    .toBe(editorPersonaId);

  // The real model actually replies under that persona: an agent turn joins the user's.
  const chatId: string = (
    await (await page.request.get('/api/agent/chats')).json()
  ).chats.find((c: { title?: string }) => c.title?.startsWith('Ping')).id;
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/agent/chats/${chatId}`);
        const body = await res.json();
        return (body.turns ?? []).some((t: { role: string }) => t.role === 'agent');
      },
      { timeout: 30000 }
    )
    .toBe(true);
  await page.screenshot({ path: 'e2e/screenshots/persona-per-chat.png', fullPage: true });
});
