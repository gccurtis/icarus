import { expect, test, type Page, type TestInfo } from "./fixtures";

const unexpected: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      unexpected.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) {
      return;
    }
    unexpected.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
  });
};

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("the system contract renders every enforcement layer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/pure-functions", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Authority enters through");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator("#checkers tbody tr")).toHaveCount(16);
  await expect(page.getByText("Mutating through an explicit port is allowed.")).toBeVisible();

  await page.getByRole("link", { name: "Open converted model" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One state. One port.");
});

test("the converted model exposes its lifecycle, pure call tree, and exact source", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/pure-functions/configuration", { waitUntil: "networkidle" });

  await expect(page.locator(".mermaid-output svg")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator("#state tbody tr")).toHaveCount(13);
  await expect(page.locator("#methods tbody tr")).toHaveCount(2);
  await expect(page.locator("#source .pf-code-file")).toHaveCount(10);

  const portSource = page.getByLabel("Source code for src/lib/model/client/configuration/port.ts").first();
  await expect(portSource).toContainText("export const bindConfiguration");
  await expect(portSource).toContainText("acquire: (context: undefined)");
  await expect(portSource).toContainText("release: (port: AcquiredConfigurationPort)");
});

test("both reference pages remain readable at a compact viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/demo/pure-functions", "/demo/pure-functions/configuration"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      ),
      `${route} should not create page-level horizontal overflow`
    ).toBe(true);
  }
});
