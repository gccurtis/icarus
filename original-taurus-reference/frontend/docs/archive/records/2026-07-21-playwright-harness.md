# Change record — 2026-07-21 — Playwright E2E harness

The front end had no runtime tests — the gate was only `pnpm check` + `pnpm build`,
neither of which exercises the app in a browser or against Omega. This adds a
Playwright harness that drives the real `dev:all` stack and produces screenshots we
can inspect, plus one login→projects smoke test. Feature-specific coverage is added
by each integration slice.

## Browsers from Nix, not a runtime download

```nix
# flake.nix — devShell
pkgs.playwright-driver.browsers
# shellHook
export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
```

**Why:** Playwright's browser binaries can't self-download inside a Nix flake.
**Purpose:** the flake supplies the browsers; npm supplies only the runner.
**Why this way:** the env points Playwright at the Nix-provided browsers and disables
the download/host-validation paths that fail under Nix.

## Pin the runner to the nixpkgs driver

```json
// package.json
"@playwright/test": "1.61.1",
"test:e2e": "playwright test"
```

**Why:** version skew between the npm runner and the Nix-provided browsers is the
classic Playwright-on-Nix failure. **Purpose:** an exact match to nixpkgs'
`playwright-driver` (1.61.1) — no `^`/`~`. **Why this way:** a floating range would
eventually drift off the Nix browser build and fail to launch Chromium.

## Config: real stack over self-signed HTTPS, gated on health, serial

```ts
// playwright.config.ts
use: { baseURL: 'https://localhost:5173', ignoreHTTPSErrors: true, screenshot: 'only-on-failure' }
webServer: { command: 'pnpm dev:all', url: 'https://localhost:5173/api/healthz',
             ignoreHTTPSErrors: true, reuseExistingServer: !process.env.CI, timeout: 120_000 }
fullyParallel: false, workers: 1
```

**Why:** dev is HTTPS self-signed and the stack is two servers (Vite + Omega).
**Purpose:** Playwright boots (or reuses) `dev:all` and starts tests only once the
health check answers *through the proxy* — proving both servers are up. **Why this
way:** gating on `/api/healthz` (not the bare origin) removes the Omega-startup race;
`workers: 1` because the suite shares one Omega backend, dev account, and project
state, so parallel runs corrupt each other (a concurrent double-register even makes
Omega return 500).

## Smoke test with an API-bootstrapped account

```ts
// e2e/smoke.spec.ts
test.beforeAll(async () => { /* POST /api/auth/register {dev@taurus.local}, tolerate 409 */ });
test('signing in lands on the projects screen', async ({ page }) => {
  await page.goto('/'); /* → /login → fill → Sign in → /projects, screenshot both */
});
```

**Why:** a fresh Omega DB has no accounts, so login has nothing to sign in with.
**Purpose:** register the dev account via API (idempotent — 409 is success), then drive
login→projects and screenshot each screen for visual review. **Why this way:** the
`beforeAll` runs after the health-gated web server is up, avoiding globalSetup ordering
pitfalls; screenshots land at stable `e2e/screenshots/*.png` paths.

## Ignore the generated output

```gitignore
# Playwright E2E
/test-results/
/playwright-report/
/e2e/screenshots/
```

**Why:** test runs produce artifacts, an HTML report, and screenshots. **Purpose:**
keep them out of version control. **Why this way:** all three are regenerated on every
run, so they are output, not source.

Verified: `pnpm test:e2e` green (1 passed) with a real Chromium launch and readable
screenshots; `pnpm check` (0/0) and `pnpm build` still pass.
