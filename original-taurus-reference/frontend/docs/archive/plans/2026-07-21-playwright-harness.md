# Playwright E2E Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Playwright E2E harness in `taurus-alpha` — browsers from the Nix flake, one login→projects smoke test that runs against the real `dev:all` stack and produces readable screenshots.

**Architecture:** Nix provides the browser binaries (no runtime download); npm provides only the pinned test runner. Playwright's `webServer` launches `pnpm dev:all` (Vite HTTPS + Omega) and gates test start on Omega's health check proxied through Vite, eliminating the startup race. One Chromium smoke test registers a dev account via API, then drives sign-in.

**Tech Stack:** Playwright (`@playwright/test`), Nix flake devShell (node 24, pnpm), SvelteKit/Vite (HTTPS via basic-ssl), Go/Omega backend.

## Global Constraints

- Work directly on `main`; make per-task local commits; **push to `main` only after the smoke test passes** (Task 5). No feature branches.
- Run all tooling through the flake: `nix develop --command <cmd>` (node/pnpm/playwright are not on the host PATH).
- `@playwright/test` is pinned to **exactly `1.61.1`** (matches nixpkgs `playwright-driver`; no `^`/`~`). Version skew is the classic failure.
- Chromium only. No visual-regression baselines. No CI wiring.
- Every hand-authored source/config file gets/keeps its `.md` companion, updated in the **same commit** (Practice 1). `e2e/*.spec.ts` are exempt (tests are self-describing); `playwright.config.ts` and `flake.nix` are not.
- Green gate before the final push: `pnpm check` (0 errors/0 warnings) and `pnpm build` must pass (Task 5).
- Design doc: `docs/superpowers/specs/2026-07-21-playwright-harness-design.md`.

---

### Task 1: Nix flake — provide Playwright browsers + env

**Files:**
- Modify: `flake.nix` (devShell `packages` + `shellHook`)
- Modify: `flake.nix.md` (companion — same commit)

**Interfaces:**
- Produces: a devShell exporting `PLAYWRIGHT_BROWSERS_PATH` (a Nix store path containing Chromium) plus the skip-download/skip-validate flags.

- [ ] **Step 1: Edit `flake.nix` — replace the `devShells.default` block with:**

```nix
        devShells.default = pkgs.mkShell {
          # Runtime + package manager for front-end work. Everything Svelte /
          # Tailwind / icon / font related lives in package.json, not here.
          # playwright-driver.browsers supplies the E2E browser binaries so
          # Playwright never downloads them at runtime (which fails under Nix).
          packages = [
            pkgs.nodejs_24
            pkgs.pnpm
            pkgs.playwright-driver.browsers
            # Tooling for editing this flake itself.
            pkgs.nil
            pkgs.nixpkgs-fmt
          ];

          shellHook = ''
            # Point Playwright at the Nix-provided browsers and stop it from
            # trying to download or host-validate them.
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            echo "taurus-alpha devShell — node $(node --version), pnpm $(pnpm --version)"
          '';
        };
```

- [ ] **Step 2: Update `flake.nix.md`** so the two changed sections (the `packages` list and the `shellHook`) reproduce the new source verbatim in their ` ```nix ` blocks, with prose noting the added `playwright-driver.browsers` package and the three `PLAYWRIGHT_*` exports.

- [ ] **Step 3: `git add` the new files so the flake can see them, then verify the browsers are present**

Run:
```bash
git add flake.nix flake.nix.md
nix develop --command bash -c 'echo "$PLAYWRIGHT_BROWSERS_PATH"; ls "$PLAYWRIGHT_BROWSERS_PATH"'
```
Expected: prints a `/nix/store/...-playwright-browsers` path, and the `ls` lists a `chromium-*` directory (among others).

- [ ] **Step 4: Commit**

```bash
git add flake.nix flake.nix.md
git commit -m "chore(e2e): provide Playwright browsers via the Nix flake"
```

---

### Task 2: package.json — pin the runner + add the script

**Files:**
- Modify: `package.json` (devDependencies + scripts)

**Interfaces:**
- Consumes: `PLAYWRIGHT_BROWSERS_PATH` from Task 1.
- Produces: `pnpm test:e2e` → `playwright test`; `@playwright/test@1.61.1` installed.

- [ ] **Step 1: Edit `package.json` — add the script** (in `"scripts"`, after `"preview"`):

```json
    "preview": "vite preview",
    "test:e2e": "playwright test",
```

- [ ] **Step 2: Edit `package.json` — add the pinned devDependency** (in `"devDependencies"`, keep alphabetical-ish; exact version, no caret):

```json
    "@playwright/test": "1.61.1",
```

- [ ] **Step 3: Install**

Run: `nix develop --command pnpm install`
Expected: completes; `pnpm-lock.yaml` updated with `@playwright/test@1.61.1`.

- [ ] **Step 4: Verify the runner version matches the Nix browsers**

Run: `nix develop --command pnpm exec playwright --version`
Expected: `Version 1.61.1`

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(e2e): add pinned @playwright/test and test:e2e script"
```

---

### Task 3: Playwright config

**Files:**
- Create: `playwright.config.ts`
- Create: `playwright.config.ts.md` (companion — same commit)

**Interfaces:**
- Produces: config with `testDir: 'e2e'`, `baseURL: https://localhost:5173`, Chromium project, and a `webServer` that runs `pnpm dev:all` and waits on `/api/healthz`.

- [ ] **Step 1: Create `playwright.config.ts`:**

```ts
import { defineConfig, devices } from '@playwright/test';

// E2E harness for the Taurus Alpha cockpit. Runs a real Chromium (browsers come
// from the Nix flake) against the full dev stack (Vite + Omega) launched by
// `pnpm dev:all`. Dev HTTPS is self-signed, so TLS errors are ignored.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev:all',
    // Gate on the whole stack: this proxies through Vite to Omega's health
    // endpoint, so tests start only once BOTH servers answer (no startup race).
    url: 'https://localhost:5173/api/healthz',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
```

- [ ] **Step 2: Create `playwright.config.ts.md`** as a verbatim companion: a short overview, then `## Code breakdown` with one `###` section per logical block whose ` ```ts ` blocks concatenate to the file exactly — the import, then the `defineConfig` call (you may split `use`, `projects`, and `webServer` into their own sections), each followed by prose explaining it.

- [ ] **Step 3: Verify the config parses**

Run: `nix develop --command pnpm exec playwright test --list`
Expected: no config error; prints `Total: 0 tests in 0 files` (no specs yet). `--list` does not start the webServer.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts playwright.config.ts.md
git commit -m "chore(e2e): add Playwright config (dev:all webServer, chromium)"
```

---

### Task 4: Smoke test + ignores (the validation gate)

**Files:**
- Create: `e2e/smoke.spec.ts` (companion-exempt)
- Modify: `.gitignore`
- Modify: `.gitignore.md` (companion — same commit)

**Interfaces:**
- Consumes: the config's `baseURL`/`webServer` (Task 3), the browsers (Task 1), the runner (Task 2).
- Produces: `e2e/screenshots/login.png` and `e2e/screenshots/projects.png`.

- [ ] **Step 1: Create `e2e/smoke.spec.ts`:**

```ts
import { test, expect, request } from '@playwright/test';

const DEV = { email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' };

// The stack is confirmed up by webServer.url (/api/healthz), so one register
// call suffices. A fresh Omega DB has no accounts; 409 means it already exists
// (idempotent), so both 201 and 409 are success.
test.beforeAll(async () => {
  const ctx = await request.newContext({
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true
  });
  const res = await ctx.post('/api/auth/register', { data: DEV });
  expect([201, 409]).toContain(res.status());
  await ctx.dispose();
});

test('signing in lands on the projects screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: 'e2e/screenshots/login.png', fullPage: true });

  await page.locator('input[type="email"]').fill(DEV.email);
  await page.locator('input[type="password"]').fill(DEV.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/projects/);
  await page.screenshot({ path: 'e2e/screenshots/projects.png', fullPage: true });
});
```

- [ ] **Step 2: Append to `.gitignore`:**

```gitignore

# Playwright E2E
/test-results/
/playwright-report/
/e2e/screenshots/
```

- [ ] **Step 3: Update `.gitignore.md`** to document the new Playwright section verbatim (a `###` block reproducing the three ignore lines + prose: test artifacts, the HTML report, and captured screenshots are all generated output).

- [ ] **Step 4: Run the smoke test — THE VALIDATION GATE**

Run: `nix develop --command pnpm test:e2e`
Expected: Playwright launches `pnpm dev:all`, waits for `/api/healthz`, runs `beforeAll` (register → 201 or 409), then the test passes (`1 passed`). If Chromium fails to launch here, the version pin (Task 2) or `PLAYWRIGHT_BROWSERS_PATH` (Task 1) is wrong — fix before proceeding.

- [ ] **Step 5: Visually confirm the screenshots**

Run: `ls -la e2e/screenshots/`
Then open/Read `e2e/screenshots/login.png` and `e2e/screenshots/projects.png` and confirm they show the sign-in screen and the projects screen respectively.

- [ ] **Step 6: Commit**

```bash
git add e2e/smoke.spec.ts .gitignore .gitignore.md
git commit -m "test(e2e): login-to-projects smoke test with screenshots"
```

---

### Task 5: Change record, spec status, green gate, push

**Files:**
- Create: `docs/records/2026-07-21-playwright-harness.md`
- Modify: `docs/superpowers/specs/2026-07-21-playwright-harness-design.md` (status line)

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Write the change record** `docs/records/2026-07-21-playwright-harness.md` (Practice 2): one `##` section per meaningful change (flake browsers+env, pinned runner+script, config, smoke test+ignores), each with a fenced block of the change and prose on *why* — Nix-provided browsers to avoid runtime downloads, exact-version pin to avoid skew, health-gated webServer to avoid the startup race, API-registered dev account so a fresh DB can sign in.

- [ ] **Step 2: Update the spec status line** in `docs/superpowers/specs/2026-07-21-playwright-harness-design.md` from `Status: approved design, pre-implementation.` to `Status: implemented (2026-07-21).`

- [ ] **Step 3: Green gate**

Run:
```bash
nix develop --command pnpm check
nix develop --command pnpm build
```
Expected: `pnpm check` reports 0 errors / 0 warnings; `pnpm build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/records/2026-07-21-playwright-harness.md docs/superpowers/specs/2026-07-21-playwright-harness-design.md
git commit -m "docs(e2e): change record + mark harness spec implemented"
```

- [ ] **Step 5: Push to `main`** (only now that the smoke test is green)

```bash
git push origin main
```
Expected: push succeeds; `git status` shows `main` up to date with `origin/main`.

---

## Self-Review

**Spec coverage:** flake browsers+env (Task 1) ✓; pinned runner + `test:e2e` (Task 2) ✓; config with dev:all webServer + HTTPS + Chromium + screenshots (Task 3) ✓; account bootstrap + login→projects smoke + ignores (Task 4) ✓; companions + change record + green gate + push (Tasks 1–5) ✓; non-goals (multi-browser, visual-regression, CI) honored ✓.

**Refinement vs spec:** `webServer.url` targets `/api/healthz` (through the Vite proxy) rather than the bare origin, so tests wait for Omega too — a strict improvement over the spec's `https://localhost:5173`, serving the same intent.

**Type consistency:** `@playwright/test@1.61.1` used consistently (Tasks 2, config, spec); `DEV` credentials identical in `beforeAll` and the test; screenshot paths match the `.gitignore` entry (`e2e/screenshots/`).
