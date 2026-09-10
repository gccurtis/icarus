import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { browserOutputDirectory } from "./scripts/browser-output-directory.mjs";

const port = Number(process.env.ICARUS_BROWSER_PORT ?? 5203);
const baseURL = process.env.ICARUS_BROWSER_BASE_URL ?? `http://127.0.0.1:${port}`;
const outputDir = browserOutputDirectory({
  override: process.env.ICARUS_BROWSER_OUTPUT_DIRECTORY,
  pid: process.pid,
  port
});
const ownsWebServer = process.env.ICARUS_BROWSER_BASE_URL === undefined;
const defaultProviderPort = port <= 55_535 ? port + 10_000 : port - 10_000;
const providerPort = Number(
  process.env.ICARUS_BROWSER_PROVIDER_PORT ?? defaultProviderPort
);
if (!Number.isInteger(providerPort) || providerPort < 1 || providerPort > 65_535) {
  throw new Error("ICARUS_BROWSER_PROVIDER_PORT must be a valid port");
}
if (ownsWebServer && providerPort === port) {
  throw new Error("The browser provider fixture must use a different port from the application");
}
const providerOrigin = `http://127.0.0.1:${providerPort}`;
const executablePath = process.env.ICARUS_CHROMIUM_EXECUTABLE;
const firefoxExecutablePath = process.env.ICARUS_FIREFOX_EXECUTABLE;
const usesLiveProviders =
  process.env.ICARUS_LIVE_RESEARCH_CHAT === "1" ||
  process.env.ICARUS_LIVE_DERIVED_OUTPUT === "1";
const ownsProviderFixture = ownsWebServer && !usesLiveProviders;

if (ownsWebServer) {
  process.env.ICARUS_BROWSER_RESET_TOKEN ??= randomUUID();
}
if (ownsProviderFixture) {
  process.env.ICARUS_BROWSER_PROVIDER_FIXTURE = "1";
  process.env.ICARUS_BROWSER_PROVIDER_ORIGIN = providerOrigin;
}

const applicationServer = {
  command: `node scripts/browser-server.mjs ${port}`,
  url: baseURL,
  reuseExistingServer: false,
  timeout: 120_000,
  ...(ownsProviderFixture
    ? {
        env: {
          ICARUS_CONFIGURATION_OVERLAY: "overlays/browser-providers.yaml",
          ICARUS_BROWSER_PROVIDER_ORIGIN: providerOrigin
        }
      }
    : {})
};

export default defineConfig({
  testDir: "./test/browser",
  outputDir,
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
    : ownsProviderFixture
      ? [
          {
            command: `node scripts/test/browser-provider-fixture.mjs ${providerPort}`,
            url: `${providerOrigin}/health`,
            reuseExistingServer: false,
            timeout: 30_000
          },
          applicationServer
        ]
      : applicationServer,
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
