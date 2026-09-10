import { expect, test, type Page, type TestInfo } from "./fixtures";

const routes = [
  ["overview", "/demo/document-editor-reference", "Architecture you can inspect."],
  ["context", "/demo/document-editor-reference/context", "Context panel"],
  ["inspector", "/demo/document-editor-reference/inspector", "Inspector panel"],
  ["content", "/demo/document-editor-reference/content", "Content surface"],
  ["runtime", "/demo/document-editor-reference/runtime", "Document runtime"],
  ["backend", "/demo/document-editor-reference/backend", "Backend and representation"],
  ["ledger", "/demo/document-editor-reference/ledger", "File change ledger"]
] as const;

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

test("every reference page loads and stays within the narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [, route, heading] of routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `${route} should not create page-level horizontal overflow`
    ).toBe(true);
  }
});

test("subsystem flows are keyboard-operable and update their procedure detail", async ({ page }) => {
  await page.goto("/demo/document-editor-reference/context", { waitUntil: "networkidle" });
  const tab = page.getByRole("tab", { name: /Find and replace/ });
  await tab.focus();
  await tab.press("Enter");
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Find view");
  await expect(panel).toContainText("hitsOf");
  await expect(panel).toContainText("A hit invalidated by another edit");
});

test("the file ledger filters measured rows without changing full-delta totals", async ({ page }) => {
  await page.goto("/demo/document-editor-reference/ledger", { waitUntil: "networkidle" });
  const fullCount = await page.locator("tbody tr").count();
  expect(fullCount).toBeGreaterThan(100);

  await page.getByPlaceholder("e.g. projection or comments").fill("apply-ops.ts");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText("representation/data/behavior/documents/apply-ops.ts");

  await page.getByLabel("Status").selectOption("A");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("representation/data/behavior/documents/apply-ops.ts");

  await page.getByPlaceholder("e.g. projection or comments").fill("");
  await page.getByLabel("Status").selectOption("all");
  await page.getByLabel("Production hotspots only").check();
  expect(await page.locator("tbody tr").count()).toBeGreaterThan(3);
  await expect(page.getByText(`Showing ${fullCount} of`, { exact: false })).toHaveCount(0);
  await expect(page.getByText(/of \d+ files/)).toBeVisible();
});
