# Playwright E2E harness — design

_Date: 2026-07-21. Status: approved design, pre-implementation._

## Context

`taurus-alpha` is built front-end-first and integrates against the real Taurus
Omega backend, yet it has **no runtime tests** today — the quality gate is only
`pnpm check` (svelte-check) + `pnpm build`, neither of which exercises the app in
a browser or against the backend. As we begin swapping mocks for real Omega calls
(the project-settings slice and those after it), we want a way to **drive the real
app end-to-end and visually confirm results**.

This increment stands up a Playwright harness. It is deliberately small: the
wiring plus **one smoke test** (login → projects). Feature-specific E2E coverage is
added by each later slice, not here.

## Goals

- Playwright runs inside the Nix flake devShell (browsers provided by Nix, not a
  runtime download).
- `pnpm test:e2e` boots the real stack via `dev:all` (Omega + Vite over HTTPS) and
  runs against it.
- One smoke test proves the whole pipeline (Vite `/api` proxy, Omega auth, the
  `to_session` cookie) and writes screenshots to a stable path for visual review.

## Non-goals (explicitly out of scope here)

- Feature flows beyond login → projects (opening a project, member management,
  resources, etc.) — these arrive with the slices that build them.
- Multi-browser coverage — **Chromium only** to start.
- Visual-regression baselines (`toHaveScreenshot`) — functional assertions +
  on-demand screenshots only, to avoid baseline flakiness.
- CI wiring — local-first; the config stays CI-friendly (`reuseExistingServer:
  !process.env.CI`) but no pipeline is added in this increment.

## Design

### 1. Nix flake wiring (the crux)

Playwright's browser binaries cannot self-download inside a Nix flake, so browsers
come from nixpkgs and npm only provides the test runner:

- Add `pkgs.playwright-driver.browsers` to the devShell `packages`.
- Export in `shellHook`:
  - `PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}`
  - `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
  - `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true`
- **Version pinning (critical).** `@playwright/test` in `package.json` MUST match
  the exact version of nixpkgs' `playwright-driver` (version skew between the npm
  runner and the Nix-provided browsers is the classic failure). At implementation
  time, read the flake's `playwright-driver.version` and pin `@playwright/test` to
  that exact version (no `^`).
- Update the `flake.nix.md` companion in the same change (Practice 1).

The **first successful Chromium launch** is the validation gate for this whole
increment.

### 2. Playwright config (`playwright.config.ts` + `.md` companion)

- `testDir: 'e2e'`.
- `use`: `baseURL: 'https://localhost:5173'`, `ignoreHTTPSErrors: true`,
  `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`.
- `projects`: Chromium only (Desktop Chrome device).
- `webServer`: `{ command: 'pnpm dev:all', url: 'https://localhost:5173',
  ignoreHTTPSErrors: true, reuseExistingServer: !process.env.CI, timeout: 120_000 }`
  — so `playwright test` launches both servers itself, or reuses a running
  `dev:all`. The generous timeout covers Omega's nested `nix develop --command go
  run ./core` first-run latency.

Vite's dev port is its default (`5173`); confirm during implementation and keep
`baseURL`/`webServer.url` in sync with it.

### 3. Account bootstrap + smoke test (`e2e/smoke.spec.ts`)

- **Account bootstrap.** A fresh Omega DB (`var/…`, gitignored) has no accounts, so
  a setup step ensures the dev account exists by POSTing to `/api/auth/register`
  with `{ email: 'dev@taurus.local', password: 'devpassword', name: 'Dev' }` via a
  Playwright `APIRequestContext` (`ignoreHTTPSErrors: true`), tolerating a `409`
  (already registered). This runs in a **`test.beforeAll` hook** in the smoke spec,
  which executes after the web server is up — avoiding `globalSetup`/`webServer`
  ordering pitfalls — and is safely idempotent (the `409` tolerance) if it runs
  more than once.
- **Smoke test.** `goto('/')` → expect redirect to `/login`; screenshot the login
  screen; fill the credentials and submit; expect to land on `/projects`; assert
  the projects screen rendered; screenshot it.
- **Screenshots.** Written to `e2e/screenshots/*.png` at stable, named paths so the
  results can be opened and reviewed directly (the agent Reads the PNGs).

### 4. Scripts, ignores, docs conventions

- `package.json`: add `"test:e2e": "playwright test"` and the pinned
  `@playwright/test` devDependency. (`package.json`/lockfile are companion-exempt.)
- `.gitignore`: add `test-results/`, `playwright-report/`, `e2e/screenshots/`;
  update `.gitignore.md`.
- Companion docs: `playwright.config.ts` gets a `.md` companion; `e2e/*.spec.ts`
  are **exempt** (tests are self-describing, matching Omega's test-exclusion
  convention). A change record is added on commit-and-push (Practice 2).

## Risks & mitigations

- **Version skew (`@playwright/test` ↔ nixpkgs `playwright-driver`)** — the main
  risk. Mitigated by pinning to the exact nixpkgs version. Symptom if wrong:
  browser fails to launch / "executable doesn't exist."
- **Browser launch under Nix** — the nixpkgs `playwright-driver.browsers` package
  supplies the needed libraries; if Chromium still fails to launch, that surfaces
  immediately at the validation gate rather than silently.
- **`dev:all` startup latency** (nested `nix develop` for Omega) — covered by the
  120s `webServer.timeout`.

## Definition of done

- `pnpm test:e2e` runs a real Chromium against a `dev:all` stack and the smoke test
  passes.
- Screenshots for the login and projects screens are produced at their stable
  paths and are viewable.
- `pnpm check` and `pnpm build` remain green; companions + a change record are in
  place.

## Follow-ups (not this increment)

- Per-slice E2E coverage, starting with the project-settings slice (members,
  rename, icon, visibility, display name), each adding targeted assertions +
  screenshots.
- Later: multi-browser, visual-regression baselines, and CI wiring, if/when they
  earn their keep.
