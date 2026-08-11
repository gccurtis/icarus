import { defineConfig, devices } from '@playwright/test';

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
