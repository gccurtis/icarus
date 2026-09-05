import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ICARUS_BROWSER_PORT ?? 5203);
const baseURL = process.env.ICARUS_BROWSER_BASE_URL ?? `http://127.0.0.1:${port}`;
const executablePath = process.env.ICARUS_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./test/browser",
  outputDir: "../test-results/document-editor",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: process.env.ICARUS_BROWSER_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : undefined
      }
    }
  ]
});
