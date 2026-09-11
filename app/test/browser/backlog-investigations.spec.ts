import { expect, test, type Page, type TestInfo } from "./fixtures";

const diagnostics: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      diagnostics.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    diagnostics.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
};

const expectNoPageOverflow = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
};

test.beforeEach(async ({ page }) => {
  diagnostics.length = 0;
  watchDiagnostics(page);
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(diagnostics, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("publishes all backlog investigations with evidence and review context", async ({ page }, testInfo) => {
  await page.goto("/demo/backlog-investigations", { waitUntil: "networkidle" });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin
  });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nine open questions");
  await expect(page.locator(".report-index nav a")).toHaveCount(9);
  await expect(page.locator("section.investigation")).toHaveCount(9);
  await expect(page.locator(".review-list textarea")).toHaveCount(4);
  await expect(page.getByText("No legacy support proposed", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "What should each external-file field mean?" })).toBeVisible();
  await expect(page.getByText(/not malware quarantine/i)).toBeAttached();
  await expect(page.getByText(/cannot represent a newly discovered URL/i)).toBeAttached();
  await expect(page.getByText(/No Electron host implementation exists/i)).toBeAttached();
  await page.locator("#top").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("backlog-investigations-desktop.png") });

  const firstEvidence = page.locator("#external-semantics details.evidence");
  await firstEvidence.locator("summary").click();
  await expect(firstEvidence.getByText("app/src/lib/capabilities/external-files/api/shared/rows.ts", { exact: true })).toBeVisible();

  const platformEvidence = page.locator("#linked-copy details.evidence");
  await platformEvidence.locator("summary").click();
  await expect(platformEvidence.getByRole("link", { name: "W3C Clipboard API and Events" })).toHaveAttribute("href", "https://www.w3.org/TR/clipboard-apis/");

  const direction = page.getByLabel("Your direction").first();
  await direction.fill("Accept findings and sources independently; retain exact provenance.");
  await expect(direction).toHaveValue("Accept findings and sources independently; retain exact provenance.");
  await page.reload({ waitUntil: "networkidle" });
  await expect(direction).toHaveValue("Accept findings and sources independently; retain exact provenance.");
  await page.getByRole("button", { name: "Copy review responses" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(
    "DEC-01 — May a finding be accepted without importing each cited source?"
  );
  await expectNoPageOverflow(page);
});

test("remains legible at compact width and Chromium zoom", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/backlog-investigations", { waitUntil: "networkidle" });
  await expectNoPageOverflow(page);

  await page.evaluate(() => {
    document.body.style.zoom = "1.25";
  });
  await expectNoPageOverflow(page);
  await expect(page.getByRole("heading", { name: "Jump to an investigation." })).toBeVisible();
  await expect(page.locator(".report-index nav a")).toHaveCount(9);
  await page.locator("#top").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("backlog-investigations-hero.png") });
  await page.locator("#external-semantics").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("backlog-investigations-investigation.png") });
  await page.locator("#review").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("backlog-investigations-review.png") });
  await page.screenshot({ path: testInfo.outputPath("backlog-investigations-compact.png"), fullPage: true });
});
