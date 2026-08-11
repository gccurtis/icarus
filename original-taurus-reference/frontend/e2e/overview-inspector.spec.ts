import { test, expect, type APIRequestContext } from '@playwright/test';
import { signedInApiContext } from './api-context';

// The Overview inspector lenses (2026-07-29): clicking a resource row inspects it,
// the checkbox set gets its own summary lens, and clicking an activity entry
// inspects the event. Row click and checkbox stay separate on purpose — glancing
// at a resource must never arm a bulk action.
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Overview Inspector' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
  await api.post('/api/session/project', { data: { projectId } });
  // Two documents so the multi-selection lens has a real count to report. The
  // first is created under a different name and renamed, which gives it a second
  // activity event — its per-resource timeline (`/activity?targetID=`) is the new
  // data path these lenses are built on, and one event would not exercise it.
  // The rename must actually change the name: Omega records nothing for a no-op.
  const ids: string[] = [];
  for (const name of ['Inspector Draft', 'Second Doc']) {
    const doc = await api.post('/api/documents', { data: { projectId, name } });
    expect([200, 201]).toContain(doc.status());
    ids.push((await doc.json()).id);
  }
  const renamed = await api.patch(`/api/resources/document/${ids[0]}`, {
    data: { name: 'Inspector Doc' }
  });
  expect(renamed.ok()).toBe(true);

  // A real content edit on that document, so an `edited` activity event exists
  // with a change set behind it. Omega writes the change set and its activity
  // fact in one atomic call sharing a `createdAt`, which is what lets the lens
  // match an event to its own change.
  const insert = await api.post(`/api/documents/${ids[0]}/changes`, {
    data: {
      submissionId: 'e2eseed0000000000000000000000001',
      expectedRevision: 0,
      operations: [
        {
          op: 'insert_row',
          row: {
            id: 'e2e_row_1',
            style: { heightIncrease: 0 },
            blocks: [
              {
                id: 'e2e_block_1',
                kind: 'text',
                subKind: 'body',
                style: { horizontalAlign: 'left', verticalAlign: 'top' },
                atoms: [{ id: 'e2e_atom_1', kind: 'text', text: 'Draft' }]
              }
            ]
          }
        }
      ]
    }
  });
  expect(insert.ok()).toBe(true);
  // The change-set response carries authoredRevision/priorRevision/seq — NOT a
  // `revision` field. The next submission's expectedRevision is the document's.
  const head = await api.get(`/api/documents/${ids[0]}`);
  const edit = await api.post(`/api/documents/${ids[0]}/changes`, {
    data: {
      submissionId: 'e2eseed0000000000000000000000002',
      expectedRevision: (await head.json()).revision,
      operations: [
        { op: 'set_atom_text', rowId: 'e2e_row_1', blockId: 'e2e_block_1', atomId: 'e2e_atom_1', setText: 'Quarterly outline' }
      ]
    }
  });
  expect(edit.ok()).toBe(true);
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

test('resource row, multi-selection, and activity each get their own lens', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Overview' }).click();

  const inspector = page.getByRole('complementary', { name: 'Inspector panel' });
  await expect(inspector.getByText('Nothing selected')).toBeVisible();

  // Click the row itself, not one of its controls. The click lands in the
  // "Updated" column — a plain span — because the row's own controls (checkbox,
  // name, the two menus) each keep their own meaning and are skipped by the
  // row's click guard.
  const row = page.getByRole('row').filter({ hasText: 'Inspector Doc' }).first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  if (!box) throw new Error('resource row has no box');
  await row.click({ position: { x: box.width - 90, y: box.height / 2 } });

  // The single-resource lens: identity, Updated/Owner, and the per-resource
  // activity list (Omega's targetID filter, which works for every kind). Created
  // and Access are deliberately absent — this lens answers "what is this and what
  // has been happening to it", not permissions.
  await expect(inspector.getByText('Inspector Doc')).toBeVisible();
  await expect(inspector.getByText('Recent activity')).toBeVisible();
  await expect(inspector.getByText('Created', { exact: true })).toHaveCount(0);

  // Sharing: owner, the control, then reach — and the owner gets the control.
  await expect(inspector.getByText('Sharing')).toBeVisible();
  await expect(inspector.getByText('Owner')).toBeVisible();
  await expect(inspector.getByText('Everyone in the project')).toBeVisible();
  await inspector.getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog', { name: /Share/ });
  await expect(shareDialog.getByRole('button', { name: 'Restricted' })).toBeVisible();
  await shareDialog.getByRole('button', { name: 'Done' }).click();

  // A row expands in place to show what that edit changed, rather than navigating.
  await inspector.getByRole('button', { name: /edited/ }).first().click();
  await expect(inspector.getByText('Before', { exact: true })).toBeVisible();
  await expect(inspector.getByText(/Quarterly outline/)).toBeVisible();

  // Clicking the row did NOT arm the bulk set — that is the whole point of
  // keeping inspection and the checkbox separate.
  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/overview-lens-resource.png', fullPage: true });

  // The checkbox set has its own lens.
  await page.getByRole('button', { name: 'Select Inspector Doc' }).click();
  await expect(inspector.getByText('1 resource selected')).toBeVisible();
  await page.getByRole('button', { name: 'Select Second Doc' }).click();
  await expect(inspector.getByText('2 resources selected')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/overview-lens-selection.png', fullPage: true });

  // An activity entry inspects that ONE event. Pick an `edited` entry, because
  // the point of this lens is the change behind the event the user clicked.
  const feed = page.getByRole('list', { name: 'Project activity' });
  const entry = feed.getByRole('button').filter({ hasText: 'edited' }).first();
  await expect(entry).toBeVisible();
  const entryBox = await entry.boundingBox();
  if (!entryBox) throw new Error('activity entry has no box');
  // Bottom-left of the entry is its timestamp line — never the actor chip or the
  // target link, which have their own meanings.
  await entry.click({ position: { x: 8, y: entryBox.height - 6 } });

  // Document first, then THIS event's change, then who and when. The change is
  // open, not behind a disclosure: "what changed here?" is why the user clicked.
  await expect(inspector.getByText('Inspector Doc')).toBeVisible();
  await expect(inspector.getByText('Change', { exact: true })).toBeVisible();
  await expect(inspector.getByText('Edited by')).toBeVisible();

  // A REAL before/after. Omega returns only the new text — the prior value is
  // private undo state — so "Draft" is recovered by walking back to the change
  // set that introduced the atom, which is the `insert_row` seeded above.
  await expect(inspector.getByText('Before', { exact: true })).toBeVisible();
  await expect(inspector.getByText('After', { exact: true })).toBeVisible();
  await expect(inspector.getByText(/Draft/)).toBeVisible();
  await expect(inspector.getByText(/Quarterly outline/)).toBeVisible();

  // Other activity comes last and expands IN PLACE — clicking a row must not
  // swap the lens to that event, because this panel is about the event you chose.
  await expect(inspector.getByText(/Other activity on this/)).toBeVisible();
  await inspector.getByRole('button', { name: /renamed/ }).first().click();
  await expect(inspector.getByText('Edited by')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/overview-lens-activity.png', fullPage: true });
});

// Omega filters GET /resources by access scope but performs NO access check on
// GET /activity — the feed hands every member each event's target id, name, and
// kind. This proves the client-side redaction that closes the gap. The real fix
// is Omega's (docs/backend-requests/resource-access-enforcement.md); until it
// lands, this test is what keeps the name off the screen.
test('a restricted resource is absent from the table and redacted in the feed', async ({ page }) => {
  const MEMBER = { email: 'member@taurus.local', password: 'devpassword', name: 'Member' };
  const memberApi = await signedInApiContext(BASE, MEMBER);

  // A document only the owner may see, in a project the member belongs to.
  const secret = await api.post('/api/documents', { data: { projectId, name: 'Confidential Plan' } });
  expect([200, 201]).toContain(secret.status());
  const secretId = (await secret.json()).id;
  const restricted = await api.patch(`/api/resources/document/${secretId}/access`, {
    data: { access: { projectWide: false, orgIds: [], userIds: [] } }
  });
  expect(restricted.ok()).toBe(true);
  // Omega's role vocabulary is read/edit/owner — not the UI's viewer/editor.
  const added = await api.post(`/api/projects/${projectId}/members`, {
    data: { email: MEMBER.email, role: 'edit' }
  });
  expect([200, 201, 409]).toContain(added.status());

  // Omega still reports the event to the member — the leak this guards.
  await memberApi.post('/api/session/project', { data: { projectId } });
  const feed = await memberApi.get('/api/activity?limit=20');
  const body = await feed.json();
  expect(JSON.stringify(body)).toContain('Confidential Plan');
  await memberApi.dispose();

  await page.goto('/');
  await page.locator('input[type="email"]').fill(MEMBER.email);
  await page.locator('input[type="password"]').fill(MEMBER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Overview' }).click();

  const activity = page.getByRole('list', { name: 'Project activity' });
  await expect(activity.getByText('Redacted').first()).toBeVisible();
  // The name never reaches the page — not in the feed, not in the table.
  await expect(page.getByText('Confidential Plan')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Confidential Plan' })).toHaveCount(0);

  // Its lens discloses that someone acted, and nothing about what they acted on.
  const redactedEntry = activity.getByRole('button').filter({ hasText: 'Redacted' }).first();
  const box = await redactedEntry.boundingBox();
  if (!box) throw new Error('redacted entry has no box');
  await redactedEntry.click({ position: { x: 8, y: box.height - 6 } });
  const inspector = page.getByRole('complementary', { name: 'Inspector panel' });
  await expect(inspector.getByText('You do not have access to this resource.')).toBeVisible();
  await expect(inspector.getByText('Timeline')).toHaveCount(0);

  // A non-owner inspecting a resource they CAN see gets the sharing facts but no
  // Share control — Omega answers 403 for anyone but the owner, so offering it
  // would be offering a button that fails.
  const visibleRow = page.getByRole('row').filter({ hasText: 'Inspector Doc' }).first();
  const rowBox = await visibleRow.boundingBox();
  if (!rowBox) throw new Error('resource row has no box');
  await visibleRow.click({ position: { x: rowBox.width - 90, y: rowBox.height / 2 } });
  await expect(inspector.getByText('Sharing')).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Share' })).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/overview-lens-redacted.png', fullPage: true });
});
