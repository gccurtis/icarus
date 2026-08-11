import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { signedInApiContext } from './api-context';

// The top-bar library nav (workspace and project selection) reaching the
// /library/* console, the mocked Templates rail panel, and the theme toggles.
// Everything asserted here is deliberately mocked UI — the spec pins the mock's
// honesty (Mock badges, unbuilt actions saying so), not backend behavior.
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Library Pass Test' } });
  expect(created.status()).toBe(201);
  projectId = (await created.json()).id;
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
}

test('the library nav reaches the console from both bars', async ({ page }) => {
  await signIn(page);

  // Project selection: Agents, Context, and Templates sit in the slim top bar.
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page).toHaveURL(/\/library\/templates/);
  await expect(page.getByText('Template library')).toBeVisible();
  // The data is not real, and the console says so rather than implying it is.
  await expect(page.getByText('Mock', { exact: true })).toBeVisible();
  // Templates get the preview + its context slots; contexts do not.
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bring into project' })).toBeVisible();

  // The spaces cross-link, and the context space shows set algebra instead.
  await page.getByRole('link', { name: 'Context' }).click();
  await expect(page).toHaveURL(/\/library\/context/);
  await expect(page.getByRole('heading', { name: 'Included' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Excluded' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Resources/ })).toBeVisible();
  // A context is reached for from its project, so it has no bring-in action.
  await expect(page.getByRole('button', { name: 'Bring into project' })).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/library-context-console.png', fullPage: true });

  // Back leaves the library rather than walking history: arriving from project
  // selection, with no project entered, it returns to the project list — NOT to
  // the templates space we cross-linked from.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/projects$/);

  // Workspace: the same nav sits left of center in the project top bar — and
  // Agents is a nav LINK now, not a workspace tab (promoted 2026-07-29).
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('button', { name: 'Project menu' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Agents' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page).toHaveURL(/\/library\/templates/);

  // …and having entered a project, Back returns to THAT project.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
});

test('the Agents space: activity monitor, task steering, personality sub-route', async ({
  page
}) => {
  await signIn(page);
  await page.goto('/library/agents');

  // The Activity view: live work grouped ahead of settled work.
  await expect(page.getByRole('heading', { name: /^Working now/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Recently finished/ })).toBeVisible();

  // With nothing selected the bar starts an agent, and the tab, the bar's leading
  // mark, and the placeholder all say so — "what should the agent do?" reads the
  // same either way, which is the ambiguity being pinned here.
  await expect(page.getByRole('tab', { name: 'New agent', exact: true })).toBeVisible();
  await expect(page.getByTitle('Starts a new agent')).toBeVisible();
  await expect(page.getByPlaceholder('Start a new agent to look into…')).toBeVisible();

  // Selecting a running task turns the detail panel into the steering seam:
  // the exchange so far, and a composer that HONESTLY reports the missing
  // backend rather than pretending to send. Retried for the hydration race
  // documented on the theme test below; "Working list" is an InspectorSection
  // title, which renders as a button, not a heading.
  await expect(async () => {
    await page.getByRole('button', { name: /Synthesise the Q3 interviews/ }).click();
    await expect(page.getByRole('button', { name: 'Working list' })).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10000 });
  // Reading the exchange is here; TYPING at the agent is the AI bar's job — one
  // composer per screen, so this panel deliberately has no Send of its own.
  await expect(page.getByText('Use the bar below to tell it what to do next.')).toBeVisible();
  await expect(page.getByLabel('Message the task')).toHaveCount(0);

  // Selecting a task re-points the whole surface at that agent: the second tab
  // becomes "Agent" (not "New agent") and the bar addresses it by name.
  await expect(page.getByRole('tab', { name: 'Agent', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'New agent' })).toHaveCount(0);
  await expect(page.getByTitle('Continues the selected task, run by Analyst')).toBeVisible();
  await expect(page.getByPlaceholder('Ask Analyst about this task…')).toBeVisible();

  // Clicking the bar shows the EXCHANGE, because talking to a selected agent is
  // the same act as reading what it has said. Not a new-agent form: that is what
  // "Agent" vs "New agent" distinguishes, so the composing controls are absent.
  await page.getByRole('tab', { name: 'Agent', exact: true }).click();
  await expect(page.getByText('Clustered 14 transcripts')).toBeVisible();
  await expect(page.getByLabel('Project')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add context' })).toHaveCount(0);

  // And the send continues that exchange rather than starting anything: the line
  // lands in the transcript, and says plainly that it went nowhere.
  const steer = page.getByPlaceholder('Ask Analyst about this task…');
  await steer.fill('Hold the pricing teardown until the enterprise pass lands.');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Hold the pricing teardown/)).toBeVisible();
  await expect(page.getByText(/Not delivered/)).toBeVisible();
  // Nothing new was born, and the lens stayed put so the reply is where you look.
  await expect(page.getByRole('tab', { name: 'Agent', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.screenshot({ path: 'e2e/screenshots/agents-agent-lens.png', fullPage: true });

  // Clicking a task while the Agent lens is open switches BACK to Task — clicking
  // a row means "show me this one".
  await page.getByRole('button', { name: /Plan the launch-note production/ }).click();
  await expect(page.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');

  // A personality is a sub-route — durable and linkable — showing its versioned
  // definition and its task history.
  await page.getByRole('button', { name: /^Analyst/ }).click();
  await expect(page).toHaveURL(/\/library\/agents\/per-analyst/);
  await expect(page.getByRole('heading', { name: /^Definition/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Task history/ })).toBeVisible();
  await expect(page.getByLabel('Behavioral guidance')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/agents-personality.png', fullPage: true });

  // One selection per work surface: selecting a task from the history and then
  // putting the caret in the definition releases it, so the bar cannot stay aimed
  // at an agent you have stopped looking at.
  await expect(async () => {
    await page.getByRole('button', { name: /Synthesise the Q3 interviews/ }).click();
    await expect(page.getByRole('tab', { name: 'Task' })).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10000 });
  await page.getByLabel('Behavioral guidance').click();
  await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'New agent' })).toBeVisible();
});

test('the context space resolves its set and the template space fills its slots', async ({
  page
}) => {
  await signIn(page);
  await page.goto('/library/context');

  // Selecting a context with a nested member: the resolved list attributes each
  // leaf to the top-level member it arrived through.
  await page.getByRole('button', { name: 'Q3 research inputs' }).click();
  await expect(page.getByRole('heading', { name: 'Resources (7)' })).toBeVisible();
  await expect(page.getByText('Included directly').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Voice and tone guide/ })).toContainText(
    'Brand voice'
  );

  // Templates: a slot starts unchosen, and choosing one flips what the prompt
  // block reads once the preview is switched to Content.
  await page.getByRole('link', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Research brief' }).click();
  await expect(page.getByText('Not chosen').first()).toBeVisible();

  // Retried because a click can land on the server-rendered DOM before Svelte
  // hydration attaches the handler — the same race the theme test documents
  // below. Verified by measurement: driven standalone against a settled page the
  // single click always selects the slot; inside the suite, straight after the
  // client-side nav from /library/context, it intermittently does not.
  await expect(async () => {
    await page.getByRole('button', { name: /^Evidence/ }).click();
    await expect(page.getByRole('button', { name: 'Choose a context' })).toBeVisible({
      timeout: 500
    });
  }).toPass({ timeout: 10000 });

  await page.getByRole('button', { name: 'Choose a context' }).click();
  const chooser = page.getByRole('dialog', { name: /Choose a context for/ });
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: /Q3 research inputs/ }).click();
  await expect(chooser).toBeHidden();

  // Prompt shows the empty slot; Content shows what fills it.
  await expect(page.getByText('Reads Evidence')).toBeVisible();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await expect(page.getByText('Reads Q3 research inputs')).toBeVisible();
});

test('the document Templates rail panel is honestly mocked', async ({ page }) => {
  await signIn(page);
  await page.goto(`/projects/${projectId}`);

  // Create a real document from Overview; its stage claims the rail.
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  // The rail's Templates SECTION is a button; the top bar's Templates is a link.
  await page.getByRole('button', { name: 'Templates', exact: true }).click();

  // Both sections present and badged Mock — nothing fake presents as real.
  await expect(page.getByText('Add a template')).toBeVisible();
  await expect(page.getByText('Make a template')).toBeVisible();
  await expect(page.getByText('Mock', { exact: true })).toHaveCount(2);

  // The Add-template modal: search narrows the mock catalog; choosing toasts
  // the mock honestly and closes.
  await page.getByRole('button', { name: 'Add template', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Add template' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Search templates').fill('pitch');
  await expect(modal.getByText('Pitch deck')).toBeVisible();
  await expect(modal.getByText('Meeting notes')).toHaveCount(0);
  await modal.getByText('Pitch deck').click();
  await expect(modal).toBeHidden();
  await expect(page.getByText(/would drop in here/)).toBeVisible();

  // Make a template: the button is gated on a name; submitting toasts the mock.
  const make = page.getByRole('button', { name: 'Make template', exact: true });
  await expect(make).toBeDisabled();
  await page.getByLabel('Template name').fill('Field report');
  await expect(make).toBeEnabled();
  await make.click();
  await expect(page.getByText(/would be saved from this document/)).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/library-templates-panel.png', fullPage: true });
});

test('the library AI bar carries the space, and answers honestly', async ({ page }) => {
  await signIn(page);
  await page.goto('/library/context');

  // The bar names the asset, not "this document" — the shared mode copy is
  // overridden per space because there is no open document out here.
  const composer = page.getByPlaceholder('Ask about this context…');
  await expect(composer).toBeVisible();

  // The bar carries the SAME control set as the rest of the app — one bar, fed
  // library data. A reduced copy is exactly what this pins against.
  await expect(page.getByLabel('AI Agent mode')).toBeVisible();
  await expect(page.getByLabel('Chat persona')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Consult the live web' })).toBeVisible();

  // Composer and panel are ONE surface: sending flips the panel to Agent.
  await expect(async () => {
    await composer.click();
    await composer.fill('What could the launch note skip?');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Agent' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 500 }
    );
  }).toPass({ timeout: 10000 });

  // The reply says what it WOULD do and then that it cannot — no silent no-op,
  // no fabricated answer.
  await expect(page.getByText(/no agent backend yet/)).toBeVisible();
  // The asset is implicit context, never a checkbox; everything else is added.
  await expect(page.getByLabel('Project')).toHaveValue('none');
  await expect(page.getByRole('button', { name: 'Add context' })).toBeVisible();

  // Switching back shows the asset again; the conversation is still there.
  await page.getByRole('tab', { name: 'Details' }).click();
  await expect(page.getByRole('button', { name: 'Sharing' })).toBeVisible();

  // Sharing and About are CLOSED at rest — three open sections read as crowding —
  // but the copy rule stays visible below them, because a standing condition of
  // the whole screen must not sit behind a disclosure. Only a template can be
  // brought into a project, so a context is not told that it can.
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
  await expect(page.getByText(/does not change the copy in/)).toBeVisible();
  await expect(page.getByText(/bringing it into a project copies it again/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Sharing' }).click();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();

  // A different space gets its own copy and its own (fresh) conversation.
  await page.getByRole('link', { name: 'Agents' }).click();
  await expect(page.getByPlaceholder('Start a new agent to look into…')).toBeVisible();
  await expect(page.getByText(/no agent backend yet/)).toHaveCount(0);
});

test('the Agents bar starts an agent as the personality you are looking at', async ({ page }) => {
  await signIn(page);
  await page.goto('/library/agents');

  // Opening a personality points the bar at it: reach for the bar on Planner
  // and you meant Planner, not the roster's default.
  await expect(async () => {
    await page.getByRole('button', { name: /^Planner/ }).click();
    await expect(page).toHaveURL(/per-planner/, { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await expect(page.getByLabel('Chat persona')).toHaveValue('per-planner');

  // One lens, and with no task selected its tab names the destination: New agent.
  await page.getByRole('tab', { name: 'New agent', exact: true }).click();
  await expect(page.getByLabel('Project')).toBeVisible();
  // Personality is the BAR's picker, never a second control in the panel.
  await expect(page.getByLabel('Personality', { exact: true })).toHaveCount(0);
  // The open personality is implicit context.
  await expect(page.getByText('What you are looking at is always in scope.')).toBeVisible();

  // The bar's text is the objective; the lens supplies where it runs.
  await page.getByLabel('Project').selectOption('Orbit');
  const before = await page.getByRole('heading', { name: /^Task history/ }).textContent();

  const bar = page.getByPlaceholder('Start a new agent to look into…');
  await bar.click();
  await bar.fill('Audit the help centre for stale pricing claims.');
  await page.keyboard.press('Enter');

  // It lands in front of you: in this personality's history, selected, panel on
  // Task — and it ran as Planner because that is what the bar was pointed at.
  await expect(page.getByRole('heading', { name: /^Task history/ })).not.toHaveText(before ?? '');
  await expect(page.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
  const row = page.getByRole('button', { name: /Audit the help centre/ });
  await expect(row).toContainText('Queued');
  await expect(row).toContainText('Orbit');
  // Queued, not running — and the task itself says why.
  await expect(page.getByText(/cannot start agents yet/)).toBeVisible();
});

test('the sign-in screen has a theme toggle naming the current mode', async ({ page }) => {
  await page.goto('/login');
  const initial = await page.evaluate(() => document.documentElement.dataset.theme);
  const current = initial === 'eclipse' ? 'Dark mode' : 'Light mode';
  const flipped = initial === 'eclipse' ? 'Light mode' : 'Dark mode';

  // The label names the mode being seen; clicking switches mode AND label.
  // Retried because a click can land on the server-rendered DOM before Svelte
  // hydration attaches the handler — the first effective click flips the label.
  await expect(async () => {
    await page.getByRole('button', { name: current, exact: true }).click();
    await expect(page.getByRole('button', { name: flipped, exact: true })).toBeVisible({
      timeout: 500
    });
  }).toPass({ timeout: 10000 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(initial === 'eclipse' ? 'celestial' : 'eclipse');

  // The choice persists through the theme store's localStorage mirror.
  await page.reload();
  await expect(page.getByRole('button', { name: flipped, exact: true })).toBeVisible();
});
