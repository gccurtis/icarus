import { expect, test, type Page, type TestInfo } from "./fixtures";

let unexpected: string[] = [];

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
  unexpected = [];
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("external-files overview describes the implemented architecture", async ({ page }) => {
  await page.goto("/demo/external-files", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("External owns files");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator(".truth-grid")).toContainText("External is a permanent category singleton");
  await expect(page.locator(".truth-grid")).toContainText("External reads the admitted File");
  await expect(page.locator(".truth-grid")).toContainText("images use the native-visual material lane");
  await expect(page.locator('.page-grid a[href="/demo/external-files/ingestion"]')).toHaveAttribute(
    "href",
    "/demo/external-files/ingestion"
  );
  await page.screenshot({ path: "/tmp/external-files-reference-overview.png", fullPage: true });
});

test("integration audit distinguishes workflow coverage, certification, and product limits", async ({ page }) => {
  await page.goto("/demo/external-files/integration", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What is covered, and what remains");
  await expect(page.getByRole("heading", { name: "Certification status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Give an Agent exact evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Edit spreadsheets across tabs" })).toBeVisible();
  await expect(page.locator("main")).toContainText("no legacy readers");
  await expect(page.locator("main")).toContainText("managed and downloadable, not parsed or previewed");
  await page.screenshot({ path: "/tmp/external-files-integration-audit.png", fullPage: true });
});

test("ingestion reference renders sequence, routing, and recovery contracts", async ({ page }) => {
  await page.goto("/demo/external-files/ingestion", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("External admits bytes");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(4, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator(".steps")).toContainText("admitNativeFile");
  await expect(page.locator(".steps")).toContainText("externalFileStorage");
  await expect(page.locator(".formats")).toContainText("PDF");
  await expect(page.locator(".formats")).toContainText("no extraction, preview, OCR, or viewer claim");
  await expect(page.locator(".formats")).toContainText("original pixels are embedded directly");
  await expect(page.getByRole("heading", { name: "Treat every uploaded byte as hostile" })).toBeVisible();
});

test("External singleton manages selected files without opening file tabs", async ({ page }) => {
  await page.goto("/demo/external-files/stable-tab", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("One library. No file editors");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "External" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".resource-table")).toContainText("quarterly-revenue.csv");
  await expect(page.getByRole("tab", { name: /pricing-engine\.ts/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Inspect pricing-engine.ts" }).click();
  await expect(page.locator(".inspector-panel")).toContainText("text/typescript");
  await expect(page.locator(".inspector-panel")).toContainText("Pricing utilities");
  await page.locator(".inspector-panel").getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Name in Icarus").fill("pricing-rules.ts");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".resource-table")).toContainText("pricing-rules.ts");
  await expect(page.locator(".inspector-panel")).toContainText("pricing-engine.ts");

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".context-panel")).toContainText("DURABLE FILE HISTORY");
  await expect(page.locator(".context-panel")).toContainText("Renamed pricing-engine.ts");
  await page.getByRole("button", { name: "Inspect vendor-contract.pdf" }).click();
  await expect(page.locator(".inspector-panel")).toContainText("application/pdf");
  await expect(page.locator(".inspector-panel")).not.toContainText("MATERIAL SUMMARY");
  await page.locator(".inspector-panel").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(page.locator(".resource-table")).not.toContainText("vendor-contract.pdf");
  await expect(page.getByRole("status")).toContainText("History entry remains");
  await expect(page.getByRole("tab", { name: /vendor-contract\.pdf/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Directory", exact: true }).click();
  await page.getByRole("button", { name: "Inspect imports folder" }).click();
  await expect(page.locator(".inspector-panel")).toContainText("Virtual directory");
  await page.locator(".workspace-specimen").screenshot({ path: "/tmp/external-files-stable-tab.png" });
});

test("file map exposes the exact implementation ledger", async ({ page }) => {
  await page.goto("/demo/external-files/file-plan", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("These are the files that changed");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator(".file-ledger")).toContainText("external-file-storage/definition.ts");
  await expect(page.locator(".file-ledger")).toContainText("Retired material-content model");
  await expect(page.locator(".file-ledger")).toContainText("relocate-external-directory");

  await page.getByPlaceholder("Filter path, owner, or reason").fill("category-keys");
  await expect(page.locator(".file-ledger article")).toHaveCount(2);
  await page.getByPlaceholder("Filter path, owner, or reason").fill("status bar");
  await expect(page.locator(".file-ledger article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "What each validation layer proves" })).toBeVisible();
});

test("implementation page records live discoveries and final concessions", async ({ page }) => {
  await page.goto("/demo/external-files/implementation", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("What the system became in code");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(4, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator(".learning-grid")).toContainText("multipart/form-data");
  await expect(page.locator(".learning-grid")).toContainText("indexed hidden relativePaths");
  await expect(page.locator(".learning-grid")).toContainText("externalFileStorage");
  await expect(page.locator(".learning-grid")).toContainText("Store atomicity");
  await expect(page.locator(".concession-grid")).toContainText("Filesystem backend");
  await expect(page.locator(".reference-table")).toContainText("one Store.transaction");
  await expect(page.getByText("The name shown to the user is External")).toBeVisible();
});

test("reference pages avoid horizontal document overflow at a compact viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/demo/external-files",
    "/demo/external-files/ingestion",
    "/demo/external-files/stable-tab",
    "/demo/external-files/file-plan",
    "/demo/external-files/implementation"
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(widths.scroll, `${path} should not overflow the document`).toBeLessThanOrEqual(widths.client + 1);
  }
});
