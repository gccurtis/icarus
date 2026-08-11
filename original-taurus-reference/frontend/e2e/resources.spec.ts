import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { signedInApiContext } from './api-context';

/**
 * Click into the editor and let ProseMirror catch up before sending keys.
 *
 * ProseMirror syncs its own state from the DOM `selectionchange` event, which is
 * asynchronous. Playwright clicks and types orders of magnitude faster than a
 * person, so a key sent in the same millisecond as the click can be applied to
 * the selection the click was replacing — Enter then REPLACES the old range
 * instead of splitting at the new caret, silently corrupting the document under
 * test. `document-inspector.spec.ts` settles the same way for the same reason.
 * This is a harness-speed artefact, not a product defect: no human produces a
 * click and a keystroke within one frame of each other.
 */
async function clickIntoEditor(editor: Locator, page: Page) {
  await editor.click();
  await page.waitForTimeout(150);
}

const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

// A fresh project (via API) so its resource catalog starts empty; deleted after
// (which cascades its resources) so the dev account stays clean between runs.
test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Resources Test' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
});

test.afterAll(async () => {
  if (projectId) await api.delete(`/api/projects/${projectId}`);
  await api.dispose();
});

test('create a real document resource: opens the editor, lists, and persists', async ({ page }) => {
  // Sign in through the browser, then open the project workspace.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto(`/projects/${projectId}`);

  // Purpose is an in-place editor: one prompt, no repeated helper or Save button,
  // and leaving the field persists the edit through Omega.
  const purposeField = page.getByPlaceholder('Add a short purpose for this project…');
  await expect(purposeField).toHaveCount(1);
  await expect(page.getByText('Describe what this project is for.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await purposeField.fill('Chart the reachable stars.');
  await purposeField.blur();
  await expect.poll(async () => {
    const response = await api.get('/api/projects');
    const body = await response.json();
    return body.projects.find((project: { id: string }) => project.id === projectId)?.purpose;
  }).toBe('Chart the reachable stars.');
  await page.reload();
  await expect(page.getByLabel('Project purpose')).toHaveValue('Chart the reachable stars.');

  // Overview's Create column: only Document is available today; the other kinds
  // render disabled with a "Soon" hint (so their accessible name is "<Kind> Soon")
  // because Omega's availableKinds is documents-only.
  const documentBtn = page.getByRole('button', { name: 'Document', exact: true });
  await expect(documentBtn).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Sheet\b/ })).toBeDisabled();
  // Slides used to be gated too; Omega now advertises it in availableKinds, so
  // the button is enabled. (This stale assertion had been failing for a while and
  // was blocking the document create/persist coverage further down this test.)
  await expect(page.getByRole('button', { name: 'Slides', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'e2e/screenshots/resources-create-gated.png', fullPage: true });

  // The activity feed loads on this fresh project even on direct navigation — it
  // retries through project selection on a 409, so it shows "No activity yet."
  // rather than an error.
  await expect(page.getByText('No activity yet.')).toBeVisible();
  await expect(page.getByText('Activity could not be loaded.')).toHaveCount(0);

  // Create a document → it opens in the real editor. The compact document bar
  // carries a real relative timestamp, mocked collaboration, and an in-place name.
  await documentBtn.click();
  const documentName = page.getByRole('button', {
    name: 'Document name: Untitled document. Double-click to rename'
  });
  await expect(documentName).toBeVisible();
  // The bar's centre cell: real last-editor attribution (no longer a mock badge —
  // Omega supplies the author) beside the live save status.
  const editMetadata = page.getByText(/^Edited/);
  await expect(editMetadata).toContainText('just now');
  await expect(editMetadata).toContainText('by Dev');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  // Presence is real now: the avatar strip exists, and its occupants come from
  // Omega sessions rather than a fixed mock cast.
  await expect(page.getByLabel('People with this document open')).toBeAttached();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-bar.png', fullPage: true });

  // Details starts with the distinct New Block lens, then follows real editor
  // selection vocabulary instead of exposing ProseMirror's cursor/node types.
  // New Block is the one lens offering Insert element, and its text-type select
  // is labelled "Style" (the Block lens labels the same control "Text type").
  await expect(page.getByText('New Block', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Insert element' })).toBeVisible();
  await expect(page.getByLabel('Style')).toBeVisible();

  // A document owns the complete context rail without inheriting project-level
  // views. Real editor-backed panels and clearly badged mock panels all render.
  for (const label of [
    'Info',
    'Search',
    'Outline',
    'Layout',
    'References',
    'Name Manager',
    'Comments',
    'AI Tasks',
    'History'
  ]) {
    await expect(page.locator(`button[aria-label="${label}"][aria-pressed]`)).toBeVisible();
  }
  await expect(page.locator('button[aria-label="Properties"][aria-pressed]')).toHaveCount(0);
  await expect(page.locator('button[aria-label="Resources"][aria-pressed]')).toHaveCount(0);
  await expect(page.locator('button[aria-label="Personas"][aria-pressed]')).toHaveCount(0);

  // Search/Replace works against live editor truth, and Outline follows heading
  // changes and navigates back to the matching block.
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type('Alpha beta Alpha');

  // A caret is Next Text: its real stored marks survive panel focus and
  // apply to subsequent typing without formatting the whole block.
  await expect(page.getByText('Next Text', { exact: true })).toBeVisible();
  const font = page.getByRole('combobox', { name: 'Font family', exact: true });
  // The control shows the EXPLICIT inline font, not the resolved cascade value:
  // with no font mark set it is empty and placeholders the inherited default, so
  // clearing it means "inherit" rather than "set to whatever the default is".
  await expect(font).toHaveValue('');
  await expect(font).toHaveAttribute('placeholder', 'Default font');
  await font.fill('Source Serif 4');
  await expect(font).toHaveValue('Source Serif 4');
  await page.getByRole('button', { name: 'Show Font family options' }).click();
  await page.getByRole('option', { name: 'IBM Plex Mono' }).click();
  await expect(font).toHaveValue('IBM Plex Mono');
  const fontSize = page.getByRole('textbox', { name: 'Font size (px)', exact: true });
  await expect(fontSize).toHaveAttribute('type', 'text');
  await expect(fontSize).toHaveValue('16');
  await page.getByRole('button', { name: 'Increase Font size (px)' }).click();
  await expect(fontSize).toHaveValue('17');
  await page.getByRole('button', { name: 'Decrease Font size (px)' }).click();
  await expect(fontSize).toHaveValue('16');
  const fontSizeBox = await fontSize.boundingBox();
  const increaseFontSizeBox = await page
    .getByRole('button', { name: 'Increase Font size (px)' })
    .boundingBox();
  expect(fontSizeBox).not.toBeNull();
  expect(fontSizeBox!.height).toBeLessThanOrEqual(32);
  expect(increaseFontSizeBox).not.toBeNull();
  expect(increaseFontSizeBox!.height).toBeLessThanOrEqual(16);
  // Quote is a real edit now (it inserts quotation marks), not a mock badge.
  await expect(
    page.getByRole('button', { name: 'Wrap selection in quotation marks' })
  ).toBeVisible();
  await page.screenshot({
    path: 'e2e/screenshots/resources-document-next-text.png',
    fullPage: true
  });
  await expect(page.getByLabel('Reference type')).toHaveValue('link');
  await expect(page.getByLabel('Reference target')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Link', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'FG color' }).click();
  await expect(page.getByRole('button', { name: 'Custom color…' })).toBeVisible();
  await page.getByRole('button', { name: 'FG #b42318' }).click();
  await expect(page.getByRole('button', { name: /Add comment/ })).toBeVisible();
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.keyboard.type('X');
  await expect(editor.locator('strong')).toContainText('X');
  await page.keyboard.press('Backspace');

  // A range is Selected Text, showing the actual range and reporting words and
  // characters. Wait for the caret lens first: ProseMirror syncs its state from
  // the DOM `selectionchange` event asynchronously, and Playwright issues keys
  // far faster than that, so selection keys sent immediately after an edit can
  // be applied to a stale selection. The lens is the app's own "synced" signal.
  await expect(page.getByText('Next Text', { exact: true })).toBeVisible();
  // The lens guard above is necessary but not sufficient: individual selection
  // keys can still be swallowed mid-flight, leaving a short selection ("Al")
  // that then sits there failing every retry of a plain assertion. Re-driving
  // the whole selection is the condition-based fix — press Home, extend five
  // times, and check; a lost key just costs another round.
  await expect(async () => {
    await page.keyboard.press('Home');
    for (let index = 0; index < 5; index += 1) await page.keyboard.press('Shift+ArrowRight');
    // The selected run shows in a fixed-height preview well (workstream A) —
    // the raw text, not the old inline curly-quoted echo.
    await expect(page.locator('.line-clamp-3')).toHaveText('Alpha', { timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(page.getByText('Selected Text', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(editor.locator('strong')).toContainText('Alpha');
  await expect(page.getByText('Instruction', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toHaveCount(0);

  // Line spacing sits in the grouped section the text lenses share, so it is
  // reachable from the range selection itself. It is the row's height increase
  // above the standard row in whole points, so its floor is 0 (it was "Row
  // height", an absolute value, before pagination was removed).
  const lineSpacing = page.getByRole('textbox', { name: 'Line spacing', exact: true });
  await expect(lineSpacing).toBeVisible();
  await expect(lineSpacing).toHaveAttribute('data-min', '0');
  const lineSpacingBox = await lineSpacing.boundingBox();
  expect(lineSpacingBox).not.toBeNull();
  expect(lineSpacingBox!.height).toBeLessThanOrEqual(32);
  await expect(page.getByRole('button', { name: 'Increase Line spacing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Decrease Line spacing' })).toBeVisible();
  // Omega bounds the extra height to two inches (144 pt). A deliberately
  // oversized UI value clamps to that canonical maximum rather than being sent.
  await lineSpacing.fill('900');
  await lineSpacing.blur();
  await expect(lineSpacing).toHaveValue('144');
  await lineSpacing.fill('12');
  await lineSpacing.blur();
  await expect(lineSpacing).toHaveValue('12');
  // Make the line a heading so the Outline coverage below has something to list.
  await page.getByLabel('Style').selectOption('heading_1');
  await page.locator('button[aria-label="Search"][aria-pressed]').click();
  await page.getByLabel('Search document').fill('Alpha');
  await expect(page.getByLabel('2 matches')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to match in block 1' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Match case', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Whole word', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Regex', exact: true }).click();
  await page.getByLabel('Search document').fill('A[a-z]+');
  await expect(page.getByLabel('2 matches')).toBeVisible();
  await page.getByLabel('Search document').fill('[');
  await expect(page.getByText('Check the regular expression syntax.')).toBeVisible();
  await page.getByRole('button', { name: 'Regex', exact: true }).click();
  await page.getByLabel('Search document').fill('Alpha');
  await page.screenshot({ path: 'e2e/screenshots/resources-document-search.png', fullPage: true });
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.getByLabel('Replacement text').fill('Gamma');
  await page.getByRole('button', { name: 'Replace next', exact: true }).click();
  await expect(editor).toContainText('Gamma beta Alpha');
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await expect(editor).toContainText('Gamma beta Gamma');
  await page.locator('button[aria-label="Outline"][aria-pressed]').click();
  await page.getByRole('button', { name: 'H1 Gamma beta Gamma', exact: true }).click();

  // Enter creates a real ROW rather than an accidental column. That used to be
  // asserted through the gutter's handle count; the gutter is gone (3866771), so
  // it is asserted where the invariant actually lives — Omega's row structure.
  await clickIntoEditor(editor, page);
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second row');
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'e2e/screenshots/resources-document-enter-rows.png',
    fullPage: true
  });

  // Seed one deliberate two-column row through Omega, then reload, and confirm
  // the bridge renders both blocks of a multi-block row.
  //
  // COVERAGE DELIBERATELY DROPPED HERE: the Row lens (child-block list, per-child
  // width fields) and the Multiple Blocks lens used to be asserted next. Both are
  // unreachable — the left gutter was their only entry point and it was removed
  // on 2026-07-23 (3866771) — and that is now BY DESIGN (catalog UX1, decided
  // 2026-07-27): row/block manipulation affordances make the product feel like a
  // block editor, and it is deliberately a text editor. These assertions are not
  // coming back; workstream D deletes the dead lenses.
  await api.post('/api/session/project', { data: { projectId } });
  const catalogResponse = await api.get('/api/resources');
  const catalog = await catalogResponse.json();
  const documentResource = catalog.resources.find(
    (resource: { kind: string; name: string }) =>
      resource.kind === 'document' && resource.name === 'Untitled document'
  );
  expect(documentResource).toBeTruthy();
  const documentResponse = await api.get(`/api/documents/${documentResource.id}`);
  const document = await documentResponse.json();
  expect(document.base.rows).toHaveLength(2);
  const columnRowIndex = document.base.rows.findIndex((row: { blocks: Array<{ atoms: Array<{ text: string }> }> }) =>
    row.blocks.some((block) => block.atoms.some((atom) => atom.text.includes('Gamma')))
  );
  expect(columnRowIndex).toBeGreaterThanOrEqual(0);
  const columnRow = document.base.rows[columnRowIndex];
  const columnBlockId = `e2ecolumn${Date.now()}`;
  const columnAtomId = `${columnBlockId}atom`;
  // Match what the client sends: Omega requires `expectedRevision` (optimistic
  // concurrency) and a `submissionId`, and the block kind is `text` — the old
  // `paragraph` kind went when the block model collapsed to 7 kinds + subKind.
  const appendColumn = await api.post(`/api/documents/${documentResource.id}/changes`, {
    data: {
      submissionId: `e2e${Date.now()}`,
      expectedRevision: document.revision,
      operations: [
        {
          op: 'insert_block',
          rowId: columnRow.id,
          afterBlock: columnRow.blocks.at(-1)?.id ?? '',
          block: {
            id: columnBlockId,
            kind: 'text',
            atoms: [{ id: columnAtomId, kind: 'text', text: 'Column peer' }]
          }
        }
      ]
    }
  });
  expect(appendColumn.status()).toBe(201);
  await page.reload();
  // Both blocks of the seeded row round-trip through the bridge and render side
  // by side — the original text and its new column peer.
  await expect(editor).toContainText('Column peer');
  await expect(editor).toContainText('Gamma beta Gamma');
  const seeded = await (await api.get(`/api/documents/${documentResource.id}`)).json();
  expect(seeded.base.rows[columnRowIndex].blocks).toHaveLength(2);
  await page.screenshot({
    path: 'e2e/screenshots/resources-document-row-inspector.png',
    fullPage: true
  });

  // Whole-block inspection now flows from the editor's own selection (the left
  // gutter's handles and the in-panel "Select full block" action were both
  // removed in 3866771, 2026-07-23). A caret in a kind that holds no formattable
  // inline text — code here — inspects as a Block, which is the only lens
  // carrying alignment and the add-column actions.
  await clickIntoEditor(editor, page);
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await expect(page.getByText('New Block', { exact: true })).toBeVisible();
  await page.getByLabel('Insert element').selectOption('code');
  await expect(page.getByText('Block', { exact: true })).toBeVisible();
  await expect(page.getByText('Next Text', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Font family', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Reference type')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Add comment/ })).toHaveCount(0);
  await expect(page.getByLabel('Align left')).toBeVisible();
  await expect(page.getByLabel('Align top')).toBeVisible();
  await expect(
    page.getByRole('separator', { name: 'Horizontal and vertical alignment' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add column left' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add column right' })).toBeVisible();
  await page.screenshot({
    path: 'e2e/screenshots/resources-document-block-inspector.png',
    fullPage: true
  });

  // Layout owns the document's BASE typography and nothing else. Page geometry
  // controls and the page-count metric went with pagination (workstream B):
  // documents render as one continuous flow, and the paper frame is read-only
  // server truth, so there is nothing here to edit.
  await page.locator('button[aria-label="Layout"][aria-pressed]').click();
  await expect(page.getByText('Default typography')).toBeVisible();
  await expect(page.getByText('Page size')).toHaveCount(0);
  await expect(page.getByText('Page height')).toHaveCount(0);
  await expect(page.getByText('Canonical page geometry')).toHaveCount(0);
  const defaultFontSize = page.getByRole('textbox', { name: 'Default font size (px)' });
  await expect(defaultFontSize).toHaveValue('16');
  await page.getByRole('button', { name: 'Increase Default font size (px)' }).click();
  await expect(defaultFontSize).toHaveValue('17');
  await expect(page.getByLabel('Default text color')).toBeVisible();
  await expect(page.getByLabel('Default background color')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-layout.png', fullPage: true });
  await page.locator('button[aria-label="References"][aria-pressed]').click();
  await expect(page.getByRole('button', { name: /This file references/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Referencing this file/ })).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-references.png', fullPage: true });
  await page.locator('button[aria-label="Name Manager"][aria-pressed]').click();
  await expect(page.getByLabel('Search document names')).toHaveAttribute('placeholder', 'Search names…');
  // The Name Manager is REAL now — named values and formulas persist through
  // Omega, so this is no longer a "· Mock" dialog with a canned result.
  await page.getByRole('button', { name: 'New name', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New name' })).toBeVisible();
  await page.getByRole('button', { name: 'Value', exact: true }).click();
  await page.getByLabel('Value').fill('42');
  await page.getByLabel('Assign result to name').fill('distance_parsecs');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New name' })).not.toBeVisible();
  await expect(page.getByText('distance_parsecs', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-name-manager.png', fullPage: true });
  // Comments are real now, so a freshly created document genuinely has none —
  // the panel shows its empty state rather than a canned "Go to comment" row.
  await page.locator('button[aria-label="Comments"][aria-pressed]').click();
  await expect(page.getByText('Anchored discussion')).toBeVisible();
  await expect(page.getByText('No open comments.')).toBeVisible();
  // History is real: entries are this session's own change sets, attributed to
  // the signed-in account, and the detail dialog offers a real targeted undo.
  await page.locator('button[aria-label="History"][aria-pressed]').click();
  await expect(page.getByText('Document activity')).toBeVisible();
  await page
    .getByRole('button', { name: `View person profile for ${DEV.email}` })
    .first()
    .hover();
  await expect(page.getByRole('tooltip')).toContainText('Created');
  await page.getByRole('button', { name: /View change:/ }).first().click();
  const changeDetail = page.getByRole('dialog', { name: 'Change detail' });
  await expect(changeDetail).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo this change' })).toBeVisible();
  await expect(changeDetail).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'e2e/screenshots/resources-document-history.png', fullPage: true });
  await changeDetail.getByText('Close', { exact: true }).click();
  // AI tasks are real: a fresh document starts with none, and a created task
  // runs under the project's default persona through Omega's agent capability.
  await page.locator('button[aria-label="AI Tasks"][aria-pressed]').click();
  await expect(page.getByText('Document AI work')).toBeVisible();
  await expect(page.getByText('No active AI tasks.')).toBeVisible();
  await page.getByRole('button', { name: 'New AI task', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New AI task' })).toBeVisible();
  await page.getByLabel('AI task instruction').fill('Check the final conclusion');
  await page.getByRole('button', { name: /Create task/ }).click();
  await expect(page.getByRole('dialog', { name: 'New AI task' })).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open AI task: Check the final conclusion' })
  ).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-ai-tasks.png', fullPage: true });
  await page.locator('button[aria-label="Info"][aria-pressed]').click();
  await expect(page.getByText('Created', { exact: true })).toBeVisible();
  // Creator attribution is REAL now (un-mocked in d7cd5ab): Omega supplies the
  // account that created the document, so this is the signed-in dev user rather
  // than the old fixed "Maya Chen" cast.
  const createdMetadata = page.getByLabel(new RegExp(`Created .* by ${DEV.email}`));
  await expect(createdMetadata.locator('time')).toHaveCount(2);
  await createdMetadata
    .getByRole('button', { name: `View person profile for ${DEV.email}` })
    .hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByText('Last updated', { exact: true })).toHaveCount(0);
  // Metrics are Words + Characters only. "Pages" left with pagination
  // (workstream B) and "Rows" left before it — neither is a thing we model.
  const documentMetrics = page.locator('dl[aria-label="Document metrics"]');
  await expect(documentMetrics.getByText('Words', { exact: true })).toBeVisible();
  await expect(documentMetrics.getByText('Characters', { exact: true })).toBeVisible();
  await expect(documentMetrics.getByText('Pages', { exact: true })).toHaveCount(0);
  await expect(documentMetrics.getByText('Rows', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Document ID', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Document counts', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Pages estimated', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Lines', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Structure', { exact: true })).toHaveCount(0);

  // The AI Agent is one connected composer/inspector surface. Selecting its rail
  // icon activates the bar, mode replaces the old scope chip, multiline input
  // grows upward through four lines, and context/artifacts stay shallow in-panel.
  await page.locator('button[aria-label="AI Agent"][aria-pressed]').click();
  const agentBar = page.getByRole('form', { name: 'AI Agent composer' });
  const agentPrompt = page.getByRole('textbox', { name: 'AI Agent prompt' });
  const agentMode = page.getByLabel('AI Agent mode');
  await expect(agentBar).toHaveAttribute('data-active', 'true');
  await expect(agentMode).toHaveValue('ask');
  await expect(agentBar.getByText('Document', { exact: true })).toHaveCount(0);
  // (The old "mode select carries no icon" assertion went with the composer
  // redesign that added the per-chat persona picker; `persona-and-surfaces.spec.ts`
  // owns the composer's current chrome.)
  await expect(page.getByText('Answer from the document and its working context, with trace when useful.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New chat', exact: true })).toHaveCount(0);
  // Context is real attachments now — Omega-backed file/folder uploads against
  // the active chat — not the old "Always included / Project knowledge" toggles.
  // Before a chat exists there is nothing to attach to, so both are disabled.
  // Scoped to the disclosure summary: the top bar now also has a "Context"
  // button (the asset-library route), so a bare getByText would match both.
  await page.locator('summary').filter({ hasText: 'Context' }).click();
  await expect(page.getByRole('button', { name: 'Add file' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add folder' })).toBeDisabled();
  await expect(page.getByText('Start a chat to attach files.')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-ai-agent-home.png', fullPage: true });

  // The composer grows UPWARD as the prompt gains lines: its bottom edge stays
  // pinned while its height increases. (The per-element vertical-centring
  // assertions that used to sit here were written before the persona picker was
  // added to the bar; `persona-and-surfaces.spec.ts` owns its chrome now.)
  const compactAgentBox = await agentBar.boundingBox();
  expect(compactAgentBox).not.toBeNull();
  await agentMode.selectOption('action');
  await expect(agentPrompt).toHaveAttribute('placeholder', 'Describe a change to make…');
  await agentPrompt.fill('Line one\nLine two\nLine three\nLine four');
  const expandedAgentBox = await agentBar.boundingBox();
  expect(expandedAgentBox).not.toBeNull();
  expect(expandedAgentBox!.height).toBeGreaterThan(compactAgentBox!.height);
  expect(
    Math.abs(
      expandedAgentBox!.y + expandedAgentBox!.height - (compactAgentBox!.y + compactAgentBox!.height)
    )
  ).toBeLessThanOrEqual(1);
  await agentPrompt.fill('One\nTwo\nThree\nFour\nFive');
  expect(await agentPrompt.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await agentPrompt.fill('');

  // Plan and Action are REAL agent turns now: they create a chat and a durable
  // task through Omega rather than rendering a canned plan with fixed steps and
  // an "Accept plan" affordance. Assert the turn round-trips; the per-chat
  // persona binding and the agent's reply are covered by
  // `persona-and-surfaces.spec.ts`, which owns the agent surface.
  await agentMode.selectOption('plan');
  await agentPrompt.fill('Prepare the final research narrative');
  await agentPrompt.press('Enter');
  await expect(page.getByText('Prepare the final research narrative').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-ai-agent.png', fullPage: true });

  await agentMode.selectOption('action');
  await agentPrompt.fill('Tighten the final conclusion');
  await agentPrompt.press('Enter');
  await expect(page.getByText('Tighten the final conclusion').first()).toBeVisible();
  expect(
    await page.locator('.panel-scroll').first().evaluate((element) => getComputedStyle(element).scrollbarWidth)
  ).toBe('none');
  expect(
    await page.locator('.document-scroll').evaluate((element) => getComputedStyle(element).scrollbarWidth)
  ).toBe('none');

  // Double-click rename persists through the real Resource endpoint and updates
  // both the document bar and its workspace tab.
  await documentName.dblclick();
  const renameInput = page.getByLabel('Rename document');
  await expect(renameInput).toBeFocused();
  await page.screenshot({ path: 'e2e/screenshots/resources-document-title-edit.png', fullPage: true });
  await renameInput.fill('Star Field Notes');
  await renameInput.press('Enter');
  await expect(
    page.getByRole('button', {
      name: 'Document name: Star Field Notes. Double-click to rename'
    })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Star Field Notes', exact: true })).toBeVisible();
  await api.post('/api/session/project', { data: { projectId } });
  await expect.poll(async () => {
    const response = await api.get('/api/resources');
    const body = await response.json();
    return body.resources.some((resource: { name: string }) => resource.name === 'Star Field Notes');
  }).toBe(true);

  // Info offers the same real in-place rename path and updates the bar/tab.
  // Info is ALREADY the active context section here (selected above), and
  // clicking the active section now collapses the panel (8160593) — so this
  // asserts it is open rather than re-clicking it shut.
  await expect(page.locator('button[aria-label="Info"][aria-pressed="true"]')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Document name in Info: Star Field Notes. Double-click to rename'
    })
    .dblclick();
  const infoRename = page.getByLabel('Rename document from Info');
  await expect(infoRename).toBeFocused();
  await infoRename.fill('Star Map Research');
  await infoRename.press('Enter');
  await expect(
    page.getByRole('button', {
      name: 'Document name: Star Map Research. Double-click to rename'
    })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Star Map Research', exact: true })).toBeVisible();
  await expect.poll(async () => {
    const response = await api.get('/api/resources');
    const body = await response.json();
    return body.resources.some((resource: { name: string }) => resource.name === 'Star Map Research');
  }).toBe(true);
  await page.screenshot({ path: 'e2e/screenshots/resources-document-open.png', fullPage: true });

  // Back on Overview, the new resource is listed in the table. The row's select
  // control ("Select <name>") is unique to the table row — unlike the tab of the
  // same name — so this asserts the row itself, not just the tab.
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByRole('button', { name: 'Select Star Map Research' })).toBeVisible();

  // It persists: a full reload re-fetches the catalog from Omega and the row is
  // still there (no localStorage stand-in). Re-select Overview after the reload —
  // workspace state (which tab is active) is Omega-backed and saved
  // asynchronously, so a reload this soon can restore the document tab instead.
  await page.reload();
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByRole('button', { name: 'Select Star Map Research' })).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/resources-table-persisted.png', fullPage: true });

  // And it's the real Omega catalog: list, and assert against what Omega
  // actually advertises rather than a frozen list. `availableKinds` is server
  // truth that grows as Omega learns kinds — pinning it to an exact array made
  // this spec fail every time the backend shipped one, so assert the invariant
  // (document is creatable) and let the rest move.
  const list = await api.get('/api/resources');
  expect(list.status()).toBe(200);
  const body = await list.json();
  expect(body.availableKinds).toContain('document');
  expect(body.resources.filter((r: { kind: string }) => r.kind === 'document').length).toBeGreaterThanOrEqual(1);
});
