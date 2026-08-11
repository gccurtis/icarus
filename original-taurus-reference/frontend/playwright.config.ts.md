# playwright.config.ts — breakdown

Companion to [playwright.config.ts](playwright.config.ts). This is the Playwright
E2E config for the Taurus Alpha cockpit: a real Chromium driven against the full
`pnpm dev:all` stack (Vite + Omega) over self-signed HTTPS, gating startup on
`/api/healthz`, and running with serial workers because the suite shares one
Omega backend.

## Imports

### Pulling in defineConfig and devices

```ts
import { defineConfig, devices } from '@playwright/test';

```

`defineConfig` gives the config object type-checking and IDE completion, and
`devices` supplies Playwright's canned device descriptors (used below for
`Desktop Chrome`). The trailing blank line separates the import from the
config.

## The config object

### Top-level run options — serial workers for a shared backend

```ts
// E2E harness for the Taurus Alpha cockpit. Runs a real Chromium (browsers come
// from the Nix flake) against the full dev stack (Vite + Omega) launched by
// `pnpm dev:all`. Dev HTTPS is self-signed, so TLS errors are ignored.
export default defineConfig({
  testDir: 'e2e',
  // Serial: the suite shares one Omega backend, dev account, and project state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
```

Tests live in `e2e/`. The suite drives a single Omega backend with one shared
dev account and mutable project state, so it must run serially — hence both
`fullyParallel: false` and `workers: 1`; parallel specs would race on the same
backend rows. `forbidOnly` fails the run if a stray `test.only` slips into CI,
`retries` allows one flake retry in CI (none locally, where you want failures to
surface immediately), and `reporter: 'html'` produces the browsable report.

### The `use` block — self-signed HTTPS and failure artifacts

```ts
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry'
  },
```

Every test navigates relative to `baseURL`, the Vite dev server on `5173` served
over HTTPS. The dev certificate is self-signed, so `ignoreHTTPSErrors` keeps the
browser from rejecting it. To keep artifacts cheap, screenshots are captured only
when a test fails and a full trace only on the first retry — enough to debug a
flake without recording every green run.

### The chromium project

```ts
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
```

A single project runs the suite under Chromium using the `Desktop Chrome` device
preset (viewport, user agent, etc.). Chromium is the browser provided by the Nix
flake, so there is no separate `npx playwright install` step and no Firefox or
WebKit target.

### The `webServer` block — launch the stack and gate on /api/healthz

```ts
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

Playwright itself boots the stack via `pnpm dev:all`, which starts both Vite and
Omega. Rather than probing the two servers separately, it polls
`https://localhost:5173/api/healthz` — a request that Vite proxies through to
Omega's health endpoint, so a `200` proves *both* the frontend and the backend
are up before any test runs (no startup race). `ignoreHTTPSErrors` again tolerates
the self-signed cert during that probe. Locally `reuseExistingServer` attaches to
a stack you already have running for a fast loop, while CI always starts fresh;
`timeout: 120_000` gives the cold stack up to two minutes to become healthy.
