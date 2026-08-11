import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { signedInApiContext } from './api-context';

// Verifies the 2026-07-27 inspector + editor pass on a real Omega-backed document:
//  - Selected Text shows the selection in a bordered, fixed three-line preview box.
//  - The grouped section carries Text type, a 0-based Line spacing increase, and Indent.
//  - Add comment is the last control; Characters / Words / Lines facts sit beneath it.
//  - Backspace at the start of an indented block outdents it instead of merging up.
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Inspector Test' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

async function openDocument(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Document name: Untitled document/ })
  ).toBeVisible();
  return page.locator('.ProseMirror');
}

test('Selected Text: stable preview box, indent in the section, facts beneath Add comment', async ({
  page
}) => {
  const editor = await openDocument(page);
  await editor.click();
  await page.keyboard.type('Alpha beta gamma');

  // Select the whole line → Selected Text lens. Re-driven on retry rather than
  // waited out: ProseMirror syncs its selection from the DOM asynchronously, and a
  // fixed settle turns a swallowed key into a hard failure instead of one more round.
  await expect(async () => {
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await expect(page.getByText('Selected Text', { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });

  // The selection preview sits in its own bordered box sized for three lines, so the
  // panel does not jump as the selection changes. `min-h-[3lh]` resolves to ~3 lines.
  const preview = page.locator('.line-clamp-3');
  await expect(preview).toContainText('Alpha');
  const metrics = await preview.evaluate((element) => {
    const style = getComputedStyle(element);
    return { minHeight: parseFloat(style.minHeight), lineHeight: parseFloat(style.lineHeight) };
  });
  expect(metrics.minHeight).toBeGreaterThan(metrics.lineHeight * 2.5);

  // The grouped section carries Text type, the 0-based Line spacing increase, and Indent.
  const lineSpacing = page.getByRole('textbox', { name: 'Line spacing' });
  await expect(lineSpacing).toBeVisible();
  await expect(lineSpacing).toHaveAttribute('data-min', '0');
  await expect(page.getByLabel('Style')).toBeVisible();
  await expect(page.getByLabel('Increase indent')).toBeVisible();
  await expect(page.getByLabel('Decrease indent')).toBeVisible();

  // Add comment is the last control; the Characters / Words / Lines facts sit beneath it.
  const addComment = page.getByRole('button', { name: /Add comment/ });
  await expect(addComment).toBeVisible();
  // The facts list is the only one carrying "Lines" (document metrics omit it).
  const facts = page.locator('dl').filter({ hasText: 'Lines' });
  await expect(facts).toContainText('Characters');
  await expect(facts).toContainText('Words');
  await expect(facts).toContainText('Lines');

  const commentBox = await addComment.boundingBox();
  const factsBox = await facts.boundingBox();
  expect(commentBox).not.toBeNull();
  expect(factsBox).not.toBeNull();
  expect(commentBox!.y).toBeLessThan(factsBox!.y);
  await page.screenshot({ path: 'e2e/screenshots/inspector-selected-text.png', fullPage: true });
});

test('Backspace outdents an indented block instead of merging it up', async ({ page }) => {
  const editor = await openDocument(page);
  const firstBlock = editor.locator('p').first();
  const paddingLeft = () => firstBlock.evaluate((element) => getComputedStyle(element).paddingLeft);

  await editor.click();
  await page.keyboard.type('Indented line');
  // Let the block round-trip so it has a real Omega block id the indent op can target.
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  // Indent one level through the inspector; the block gains left padding.
  await expect(page.getByText('Next Text', { exact: true })).toBeVisible();
  await page.getByLabel('Increase indent').click();
  await expect.poll(paddingLeft).not.toBe('0px');

  // Caret to the very start of the block, then Backspace → outdent (not merge). The
  // padding returns to zero and the text is preserved (no join with a block above).
  await firstBlock.click();
  await page.keyboard.press('Home');
  // Let ProseMirror sync the native Home caret move into its own selection state
  // before Backspace (a real user's keystroke gap covers this; automation races it).
  await page.waitForTimeout(200);
  await page.keyboard.press('Backspace');
  await expect.poll(paddingLeft).toBe('0px');
  await expect(editor).toContainText('Indented line');
  await page.screenshot({ path: 'e2e/screenshots/inspector-backspace-outdent.png', fullPage: true });
});

test('the text selection stays visible when the inspector takes focus', async ({ page }) => {
  const editor = await openDocument(page);
  await editor.click();
  await page.keyboard.type('Persistent selection');
  // Ten separate Shift+ArrowRight presses, any of which can be swallowed while
  // ProseMirror is still syncing its state from the DOM `selectionchange` event.
  // A fixed settle only hides that: if a key IS lost the selection stays short
  // and every retry of the assertion sees the same wrong state. Re-driving the
  // whole selection is the condition-based fix — a lost key costs one more round.
  await expect(async () => {
    await page.keyboard.press('Home');
    for (let index = 0; index < 10; index += 1) await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByText('Selected Text', { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });

  // Focused: the native ::selection shows, so no hold decoration is painted.
  await expect(editor.locator('.taurus-selection-hold')).toHaveCount(0);
  // Focusing an inspector control blurs the editor → the range is held highlighted so the
  // selection does not appear to vanish while the side panel is in use.
  await page.getByLabel('Style').focus();
  await expect(editor.locator('.taurus-selection-hold')).toHaveCount(1);
  await page.screenshot({ path: 'e2e/screenshots/inspector-selection-hold.png', fullPage: true });
});

// Regression: a run selection reports only block ids, so the panel used to derive an empty
// row-key list and call setRowHeight([], …) — which resolves no rows and did nothing at all.
test('Line spacing applies to a text run, not only to whole-block selections', async ({ page }) => {
  const editor = await openDocument(page);
  const firstBlock = editor.locator('p').first();
  const minHeight = () =>
    firstBlock.evaluate((element) => parseFloat(getComputedStyle(element).minHeight) || 0);

  await editor.click();
  await page.keyboard.type('Spacing across a run');
  // Let the block round-trip so it belongs to a real Omega row the height op can target.
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const before = await minHeight();

  // Select the whole line → the Selected Text (run) lens, not a block lens.
  await expect(async () => {
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await expect(page.getByText('Selected Text', { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(page.getByText('Selected Text', { exact: true })).toBeVisible();

  // Raise the spacing. The run has to name its own rows for this to reach the document.
  const lineSpacing = page.getByRole('textbox', { name: 'Line spacing' });
  await lineSpacing.fill('24');
  await lineSpacing.press('Enter');

  await expect.poll(minHeight).toBeGreaterThan(before);
  await page.screenshot({ path: 'e2e/screenshots/inspector-run-line-spacing.png', fullPage: true });
});

test('a code block inspects as a Block, not the Next Text typography lens', async ({ page }) => {
  const editor = await openDocument(page);
  // Fresh document → New Block lens with the Insert element control.
  await expect(page.getByText('New Block', { exact: true })).toBeVisible();
  await page.getByLabel('Insert element').selectOption('code');

  // The caret now sits in a code block: it inspects as a Block and never offers Next Text
  // (no inline-typography lens for code).
  await expect(editor.locator('[data-kind="code"], pre')).toHaveCount(1);
  await expect(page.getByText('Next Text', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Block', { exact: true })).toBeVisible();
});
