import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { signedInApiContext } from './api-context';
import { clickWithDiagnostics, waitForApiQuiet } from './diagnostics';

// Session expiry must force a return to sign-in (2026-07-28). Omega sessions
// lapse server-side (dev TTL: 24h); before this pass the client kept rendering
// signed-in UI on stale store state until a manual refresh — presence joins
// toasted failures, fetches died quietly. Expiry is simulated by deleting the
// to_session cookie mid-session, which Omega's gate treats identically to an
// expired one (anonymous → 401).
const BASE = 'https://localhost:5173';
const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

let api: APIRequestContext;
let projectId = '';

test.beforeAll(async () => {
  api = await signedInApiContext(BASE, DEV);
  const created = await api.post('/api/projects', { data: { name: 'Session Expiry Test' } });
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

test('an expired session bounces to sign-in on the next API touch, and ?next= returns you', async ({
  page
}) => {
  // NO raised budget here, deliberately. This test makes no model calls and
  // finishes in ~4s. It was briefly given 90s after an intermittent failure —
  // the wrong instinct, and it failed anyway, because the failure was never
  // slowness. Instrumenting the click found the real cause in one run (see the
  // note before `waitForApiQuiet` below); a bigger budget would only have
  // bought a longer wait for the same wrong answer.
  //
  // The user's live repro: workspace → Templates library → Back. The return
  // remounts the project page, whose project-select call is the first API
  // touch after expiry.
  await signIn(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('button', { name: 'Project menu' })).toBeVisible();

  // Wait for the project page to STOP fetching before revoking the cookie.
  //
  // This is the fix for a failure that was twice mistaken for load. The top bar
  // renders as soon as the shell mounts, but the Overview stage is still loading
  // `/activity` and `/resources` behind it. Revoke the cookie during that window
  // and those in-flight requests come back 401 — so the expiry watcher does
  // exactly its job and hard-navigates to /login, wiping out the top bar this
  // test is about to click. Measured, not guessed: the instrumented click
  // reported `urlAtFailure: /login?expired=1&next=/projects/…`, and Omega's log
  // showed the 401s were `/activity?limit=8` and `/resources?limit=100`.
  //
  // So the app was right and the test's premise ("no API calls here") was wrong.
  await waitForApiQuiet(page);
  await page.context().clearCookies({ name: 'to_session' });

  // The bounce is a hard reload; the next /auth/me is the reloaded login
  // page's hydration probe. Awaiting it below is the evidence that hydration
  // finished — clicking Sign in earlier would native-submit and drop ?next=.
  const loginHydrated = page.waitForResponse((r) => r.url().includes('/api/auth/me'));

  // Client-side navigation still works on stale state: this link is a route
  // change with no API call of its own, so nothing 401s and nothing bounces.
  // (That holds only because the page's own loads finished above — the earlier
  // version of this test assumed it unconditionally, which is what broke.)
  //
  // Kept on `clickWithDiagnostics`: the click is unchanged, but if it ever fails
  // again the harness reports the page's URL, which actionability condition was
  // unmet, and the app's own recent log events — instead of a bare timeout.
  await clickWithDiagnostics(page.getByRole('link', { name: 'Templates' }), 'top-bar Templates link');
  await expect(page).toHaveURL(/\/library\/templates/);

  // …but returning to the project touches the API and gets bounced, with the
  // reason and the way back carried in the query. Generous timeout: this spans
  // a POST, the 401, and a full page load.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/login\?expired=1&next=%2Fprojects%2F/, { timeout: 10000 });
  await expect(page.getByText('Your session expired — sign in to continue.')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/session-expired-login.png', fullPage: true });
  await loginHydrated;

  // Signing back in honors ?next= — straight back to the project.
  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`), { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Project menu' })).toBeVisible();
});

test('a session that lapsed while the tab sat idle is caught when the tab returns', async ({
  page
}) => {
  await signIn(page);
  await page.context().clearCookies({ name: 'to_session' });

  // No clicking, no fetching — just the tab becoming visible again triggers
  // the watcher's /auth/me probe, and the 401 bounces to sign-in.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page).toHaveURL(/\/login\?expired=1&next=%2Fprojects/, { timeout: 10000 });
  await expect(page.getByText('Your session expired — sign in to continue.')).toBeVisible();
});
