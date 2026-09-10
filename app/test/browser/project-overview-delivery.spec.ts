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
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) return;
    unexpected.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
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

test("explains the complete pinned delivery", async ({ page }) => {
  await page.goto("/demo/project-overview-panels/delivery", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { level: 1, name: "From panel concept to production boundary." })
  ).toBeVisible();
  const range = page.getByLabel("Git comparison range");
  await expect(range.getByText("3e670c5", { exact: true })).toBeVisible();
  await expect(range.getByText("930fb95", { exact: true })).toBeVisible();
  await expect(page.locator("[data-delivery-area]")).toHaveCount(6);
  await expect(page.locator("[data-delivered-panel]")).toHaveCount(6);
  await expect(page.locator("[data-capability-entry]")).toHaveCount(7);
  await expect(page.locator("[data-delta-file]")).toHaveCount(78);
  await expect(page.getByText("1,111 / 1,111", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /File ledger/ }).click();
  await expect(page.locator("#ledger")).toBeInViewport();
});

test("stays readable at a narrow Chromium viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/project-overview-panels/delivery", { waitUntil: "networkidle" });

  await expect(page.locator("[data-delivered-panel]").first()).toBeVisible();
  await page.locator("#ledger details").nth(1).locator("summary").click();
  await expect(page.locator("#ledger details").nth(1)).toHaveAttribute("open", "");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  ).toBe(true);
});
