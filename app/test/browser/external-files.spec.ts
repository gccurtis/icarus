import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

test("External ingests, downloads, renames, and deletes a native file without opening an editor tab", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  const externalTab = tabs.getByRole("button", { name: "External", exact: true });
  await expect(externalTab).toBeVisible();
  await externalTab.click();
  await expect(externalTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "External" })).toBeVisible();
  await expect(page.getByText("files do not open editors or tabs of their own")).toBeVisible();

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({
    name: "live-notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("External files remain native.\n")
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();

  await expect(page.getByText("1 uploaded · 0 reused · 0 rejected.")).toBeVisible();
  const table = page.getByRole("table");
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(table.getByRole("button", { name: "live-notes.md", exact: true })).toBeVisible();
  await expect(page.getByText("Original name").locator(".." )).toContainText("live-notes.md");
  await expect(tabs.getByRole("button", { name: /live-notes\.md/ })).toHaveCount(0);

  const download = page.getByRole("link", { name: "Download", exact: true });
  const href = await download.getAttribute("href");
  expect(href).not.toBeNull();
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["etag"]).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  expect(await response.text()).toBe("External files remain native.\n");

  await inspector.getByRole("button", { name: "live-notes.md", exact: true }).click();
  await page.getByLabel("File display name").fill("Live research notes");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(table.getByRole("button", { name: "Live research notes", exact: true })).toBeVisible();
  await expect(page.getByText("Original name").locator(".." )).toContainText("live-notes.md");

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete Live research notes?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(table.getByRole("button", { name: "Live research notes", exact: true })).toHaveCount(0);
  await expect(page.getByText("No external files yet")).toBeVisible();
});
