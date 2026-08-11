import { test, expect, type APIRequestContext } from '@playwright/test';
import { signedInApiContext } from './api-context';

// The left-rail "All resources" panel's Import / Export modals, after workstream D
// made them kind-agnostic (the per-kind knowledge moved to features/shared/transfer.ts).
// Asserts the modals render what the transfer table declares: the Markdown import
// copy + picker, the generic export empty state, and a real document listed as
// exportable once one exists. Written when the L4 seam landed — these modals had
// no coverage before.
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Transfer Seam Check' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

test('kind-agnostic import/export modals still work', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);

  await page.getByRole('button', { name: 'All resources' }).click();
  // Buttons named Import/Export exist in the top bar (0), the rail panel (1),
  // and the Overview table (2) — the rail panel's is the one under test.
  await page.getByRole('button', { name: 'Import' }).nth(1).click();
  const importDialog = page.getByRole('dialog', { name: 'Import' });
  await expect(importDialog).toBeVisible();
  await expect(importDialog.getByText('Choose a Markdown file…')).toBeVisible();
  await expect(importDialog.getByText(/Import a Markdown/)).toBeVisible();
  await importDialog.getByRole('button', { name: 'Cancel' }).click();

  // Empty project: export modal shows the generic empty state.
  await page.getByRole('button', { name: 'Export' }).nth(1).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export' });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByText('Nothing in this project can be exported yet.')).toBeVisible();
  await exportDialog.getByRole('button', { name: 'Close' }).last().click();

  // Seed a document through the real API, then the export modal lists it.
  await api.post('/api/session/project', { data: { projectId } });
  const doc = await api.post('/api/documents', {
    data: { projectId, name: 'Exportable Doc' }
  });
  expect([200, 201]).toContain(doc.status());
  await page.reload();
  // The new document may be the active tab (workspace state); the project rail
  // (with the All resources panel) is the fallback, so focus Overview first.
  // The resources section is already active + expanded (persisted), and
  // re-clicking an active section collapses the panel — so don't click it.
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByText('Create', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Export' }).getByText('Exportable Doc')).toBeVisible();
});

// The 2026-07-28 export pass: ONE format table (features/shared/transfer.ts) feeds
// the editor's Export menu, each resource row's Download menu, and the shell top
// bar, so the three cannot drift. Markdown is real; the other three carry "soon"
// in their own label and say so plainly rather than downloading a placeholder.
test('every export surface offers the same four formats, and only Markdown is real', async ({
  page
}) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Overview' }).click();

  const FORMATS = [
    'Markdown (.md)',
    'Word (.docx) — soon',
    'PDF (.pdf) — soon',
    'Taurus (.tdoc) — soon'
  ];

  // A resource row's Download button is a menu now, not a one-shot download —
  // it used to fetch a placeholder file with none of the document's content.
  // Named "Row download" so it is distinguishable from the header's bulk
  // Download; both still show "Download" as their tooltip.
  await page.getByRole('button', { name: 'Row download' }).first().click();
  const rowMenu = page.getByRole('menu');
  for (const label of FORMATS) await expect(rowMenu.getByText(label)).toBeVisible();
  // Choosing an unbuilt format is honest rather than silent.
  await rowMenu.getByText('PDF (.pdf) — soon').click();
  await expect(page.getByText(/PDF export isn’t built yet/)).toBeVisible();

  // The editor's Export menu offers the identical set.
  //
  // Wait for the editor itself before reaching for the trigger. There are two
  // buttons named Export on this page — the shell top bar's (a deliberate mock
  // with its own items) and the document bar's — and `.last()` only means the
  // editor's once the editor exists. Without this the toast above can still be
  // covering the row, the document never opens, and `.last()` silently resolves
  // to the top bar's mocked menu instead.
  await page.getByText('Exportable Doc').first().click();
  await expect(page.locator('.ProseMirror')).toBeVisible();
  const exportTrigger = page.getByRole('button', { name: 'Export' }).last();
  await expect(exportTrigger).toBeVisible();
  await exportTrigger.click();
  const editorMenu = page.getByRole('menu');
  for (const label of FORMATS) await expect(editorMenu.getByText(label)).toBeVisible();
  await page.keyboard.press('Escape');

  // The document bar reads save-state first, then attribution.
  const bar = page.getByText(/Saved|Saving/).first();
  await expect(bar).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/export-formats.png', fullPage: true });
});
