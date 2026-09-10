import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";

const port = Number(process.env.ICARUS_BROWSER_PORT ?? 5203);
const baseURL = process.env.ICARUS_BROWSER_BASE_URL ?? `http://127.0.0.1:${port}`;
const executablePath = process.env.ICARUS_CHROMIUM_EXECUTABLE;
const firefoxExecutablePath = process.env.ICARUS_FIREFOX_EXECUTABLE;
const ownsWebServer = process.env.ICARUS_BROWSER_BASE_URL === undefined;

if (ownsWebServer) {
  process.env.ICARUS_BROWSER_RESET_TOKEN ??= randomUUID();
}

export default defineConfig({
  testDir: "./test/browser",
  outputDir: "../test-results/document-editor",
  fullyParallel: false,
  // Browser scenarios share one resettable document fixture and must not race writes across files.
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: !ownsWebServer
    ? undefined
    : {
        command: `node scripts/browser-server.mjs ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : undefined
      }
    },
    ...(firefoxExecutablePath
      ? [
          {
            name: "firefox",
            use: {
              ...devices["Desktop Firefox"],
              launchOptions: { executablePath: firefoxExecutablePath }
            }
          }
        ]
      : [])
  ]
});
