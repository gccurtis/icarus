import { test, expect, type APIRequestContext } from '@playwright/test';
import { signedInApiContext } from './api-context';

// The project-context rail (2026-07-29): Properties reads the project and routes
// into the real dialogs; All resources is a navigator with a fixed transfer/search
// head over collapsible groups.
//
// The structural claim under every lens is that `SidePanel`'s own scroller goes
// INERT when a lens roots itself at `flex h-full flex-col` — so this spec asserts
// it directly (the panel body does not scroll; the results box does), because a
// regression there would silently un-pin the head of every lens.
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', {
    data: { name: 'Context Rail' }
  });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
  await api.post('/api/session/project', { data: { projectId } });
  await api.patch(`/api/projects/${projectId}`, {
    data: { purpose: 'Prove the rail holds its head still.' }
  });

  // Enough documents that the group list overflows the rail (the scroll test also
  // shortens the viewport) — the point of the fixed head is that transfer and
  // search survive that overflow.
  const ids: Record<string, string> = {};
  for (const name of [
    'Launch plan',
    'Q3 brief',
    'Meeting notes',
    'Hiring loop',
    'Runbook',
    'Retro',
    'Roadmap',
    'Onboarding',
    'Postmortem',
    'Budget draft'
  ]) {
    const doc = await api.post('/api/documents', { data: { projectId, name } });
    expect([200, 201]).toContain(doc.status());
    ids[name] = (await doc.json()).id;
  }

  // One pinned resource, so the `Pinned` group is real in the browser and not only
  // in `resource-groups.test.ts`.
  const pinned = await api.patch(`/api/resources/document/${ids['Launch plan']}/attributes`, {
    data: { pinned: true }
  });
  expect(pinned.ok()).toBe(true);
});

/**
 * Open a rail section, whatever state the persisted workspace left it in.
 *
 * The icon rail's buttons are a toggle: clicking the ALREADY-active section
 * collapses the panel. `aria-pressed` is exactly "this section is open", so this
 * clicks only when it needs to — a spec that clicks unconditionally closes the
 * rail it meant to open, which is how this helper came to exist.
 */
async function openSection(page: import('@playwright/test').Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await expect(page.getByRole('complementary', { name: 'Context panel' })).toBeVisible();
}

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

test('Properties reports the project and routes to the real dialogs', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  // Workspace state persists per project (and across runs), so a previous case may
  // have left a document tab active — and a resource stage contributes its OWN
  // context set, which would leave the project rail off screen entirely.
  await page.getByRole('button', { name: 'Overview', exact: true }).click();

  const rail = page.getByRole('complementary', { name: 'Context panel' });
  await openSection(page, 'Properties');

  await expect(rail.getByText('Context Rail')).toBeVisible();
  await expect(rail.getByText('Prove the rail holds its head still.')).toBeVisible();
  await expect(rail.getByText('Private', { exact: true })).toBeVisible();
  // The roster's owner, resolved through the shared `roster` store.
  await expect(rail.getByRole('term').filter({ hasText: 'Project owner' })).toBeVisible();
  await expect(rail.getByRole('definition').filter({ hasText: '(you)' })).toBeVisible();
  // Ten documents, counted from the loaded catalog rather than a second request.
  await expect(rail.getByText('10 resources')).toBeVisible();
  await expect(rail.getByText('Documents')).toBeVisible();

  // "Last activity" is Omega's max(project updatedAt, newest activity) — a real
  // timestamp, so it must not read as the epoch.
  await expect(rail.getByText('1/1/1970')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/context-rail-properties.png', fullPage: true });

  // Share mounts the SAME ProjectSharing the top bar and settings do.
  await rail.getByRole('button', { name: 'Share' }).click();
  const share = page.getByRole('dialog', { name: /Share/ });
  await expect(share.getByRole('button', { name: 'Anyone with link' })).toBeVisible();
  await share.getByRole('button', { name: 'Done' }).click();

  await rail.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Project settings' });
  await expect(settings).toBeVisible();
  await page.keyboard.press('Escape');
});

test('History is the whole timeline, grouped by day', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();

  const rail = page.getByRole('complementary', { name: 'Context panel' });
  await openSection(page, 'History');

  // Eleven seeded creations, so the first page (25) holds them all: the footer
  // reports the end of history rather than offering more.
  await expect(rail.getByText('Today')).toBeVisible();
  await expect(rail.getByText(/created/).first()).toBeVisible();
  await expect(rail.getByText('That’s the whole history.')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/context-rail-history.png', fullPage: true });

  // Filtering: the dialog builds the filter, chips report it, and the footer states
  // the scope the count was taken over.
  await rail.getByRole('button', { name: /Filter/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter activity' });
  await expect(dialog).toBeVisible();

  // One named resource — the case Omega can answer itself via ?targetID=.
  await dialog.getByRole('textbox', { name: 'Find a resource to filter by' }).fill('Runbook');
  await dialog.getByText('Runbook', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply' }).click();

  await expect(rail.getByRole('button', { name: 'Remove filter Runbook' })).toBeVisible();
  await expect(rail.getByText(/1 of 1 searched/)).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/context-rail-history-filtered.png', fullPage: true });

  // A whole kind instead: "All documents" is one chip, not eleven.
  await rail.getByRole('button', { name: 'Remove filter Runbook' }).click();
  await rail.getByRole('button', { name: /Filter/ }).click();
  await dialog.getByRole('button', { name: /Documents All/ }).click();
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(rail.getByRole('button', { name: 'Remove filter All documents' })).toBeVisible();
  // The scope line always states what the count was taken over, and says so
  // explicitly once the feed is exhausted. (Exact numbers are left loose: seeding a
  // project also produces attribute events, so the total is not just the 11 docs.)
  await expect(rail.getByText(/\d+ of \d+ searched — the whole history/)).toBeVisible();
  await rail.getByRole('button', { name: 'Remove filter All documents' }).click();

  // A row opens its target rather than driving the inspector — the Activity lens
  // belongs to the Overview stage, and this rail outlives it.
  await rail.getByRole('button', { name: 'Runbook' }).first().click();
  await expect(page.getByRole('button', { name: 'Outline', exact: true })).toBeVisible();
});

test('Members reports access, and badges the presence it cannot know', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();

  const rail = page.getByRole('complementary', { name: 'Context panel' });
  await openSection(page, 'Members');

  // The dev account is the only member, so it is the whole roster — and it is you,
  // which is real presence rather than mocked (the point of the backend request).
  await expect(rail.getByText('1 person has access')).toBeVisible();
  await expect(rail.getByText('On now')).toBeVisible();
  await expect(rail.getByText('(you)')).toBeVisible();
  await expect(rail.getByText('Owner', { exact: true })).toBeVisible();
  // Nobody else is present, so nothing is invented and no Mock badge appears.
  await expect(rail.getByText('Mock')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/context-rail-members.png', fullPage: true });

  // Manage access mounts the same ProjectSharing the Share dialog and settings do.
  await rail.getByRole('button', { name: 'Manage access' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage access' });
  await expect(dialog.getByRole('button', { name: 'Anyone with link' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Personas is gone from the rail — agent authoring lives at /library/agents now.
  await expect(page.getByRole('button', { name: 'Personas', exact: true })).toHaveCount(0);
});

test('All resources keeps transfer and search fixed while the groups scroll', async ({ page }) => {
  // A short viewport so ten documents genuinely overflow the results box — the
  // structural assertion below is vacuous if nothing needs to scroll.
  await page.setViewportSize({ width: 1280, height: 520 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  // Workspace state persists per project (and across runs), so a previous case may
  // have left a document tab active — and a resource stage contributes its OWN
  // context set, which would leave the project rail off screen entirely.
  await page.getByRole('button', { name: 'Overview', exact: true }).click();

  const rail = page.getByRole('complementary', { name: 'Context panel' });
  await openSection(page, 'All resources');

  // Pinned leads, and its resource is ALSO under Documents — pinning is a
  // shortcut, not a relocation.
  await expect(rail.getByRole('button', { name: /Pinned/ })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Launch plan' })).toHaveCount(2);

  const search = rail.getByRole('textbox', { name: 'Find a resource' });
  await expect(search).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Import' })).toBeVisible();

  // The group header carries the count of what is under it.
  const documents = rail.getByRole('button', { name: /Documents/ });
  await expect(documents).toBeVisible();
  await expect(documents).toHaveAttribute('aria-expanded', 'true');

  // THE STRUCTURAL ASSERTION: the panel body is not the scroller — the results
  // box inside the lens is. If a future change re-introduces outer scrolling, the
  // fixed head stops being fixed, and this is what catches it.
  const geometry = await rail.evaluate((aside) => {
    const body = aside.querySelector('.panel-scroll');
    const results = aside.querySelector('.panel-results');
    if (!body || !results) throw new Error('rail body or results box not found');
    return {
      bodyScrolls: body.scrollHeight > body.clientHeight + 1,
      resultsScrolls: results.scrollHeight > results.clientHeight + 1
    };
  });
  expect(geometry.bodyScrolls).toBe(false);
  expect(geometry.resultsScrolls).toBe(true);
  await page.screenshot({ path: 'e2e/screenshots/context-rail-resources.png', fullPage: true });

  // Search filters the groups and reports what it kept, out of what.
  await search.fill('brief');
  await expect(rail.getByText('1 of 10 match')).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Q3 brief' })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Launch plan' })).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/context-rail-search.png', fullPage: true });

  await search.fill('zzz');
  await expect(rail.getByText(/Nothing matches/)).toBeVisible();
  await search.fill('');

  // Collapsing a group hides its rows; the header stays.
  await documents.click();
  await expect(documents).toHaveAttribute('aria-expanded', 'false');
  await expect(rail.getByRole('button', { name: 'Q3 brief' })).toHaveCount(0);

  // …and a search overrides the collapse, because hiding what you just searched
  // for would be the wrong answer.
  await search.fill('brief');
  await expect(rail.getByRole('button', { name: 'Q3 brief' })).toBeVisible();
  await search.fill('');

  // Opening a row opens the resource — which hands the rail to the DOCUMENT stage's
  // own context set, so the project rail is not on screen while it is active. Back on
  // Overview, the row is marked as having a tab open.
  await documents.click();
  await rail.getByRole('button', { name: 'Q3 brief' }).click();
  // The rail is now the document's context set, not the project's — which is why
  // marking only the ACTIVE resource would have been a near-invisible affordance.
  await expect(page.getByRole('button', { name: 'Outline', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All resources', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await openSection(page, 'All resources');
  await expect(rail.getByRole('button', { name: /Q3 brief/ }).first()).toBeVisible();
  await expect(rail.getByLabel('Open in a tab').first()).toBeVisible();
});
