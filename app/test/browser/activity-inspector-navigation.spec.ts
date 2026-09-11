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
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

const activityInspectorFor = async (page: Page, search: string, row: RegExp) => {
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "History", exact: true }).click();
  await context.getByPlaceholder("Search history").fill(search);
  const activity = context.getByRole("button", { name: row });
  await expect(activity).toBeVisible();
  await activity.click();
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector).toHaveAttribute("data-inspected", "project-overview.activity");
  return { tabs, inspector };
};

test("Where opens the current Agents task from a typed lifecycle event", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const agents = page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Agents", exact: true });
  const main = page.getByRole("main");

  const { inspector } = await activityInspectorFor(
    page,
    "winter storm precedents",
    /Completed an Agents task: Summarise winter storm precedents/
  );
  await inspector
    .getByRole("button", {
      name: "Summarise winter storm precedents in neighbouring utilities",
      exact: true
    })
    .click();
  await expect(agents).toHaveAttribute("aria-current", "page");
  await expect(main.getByLabel("Task name")).toHaveValue(
    "Summarise winter storm precedents in neighbouring utilities"
  );
});

test("Where opens a current External file and leaves deleted history as text", async ({ page }, info) => {
  const name = "activity-destination.md";
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  const external = tabs.getByRole("button", { name: "External Files", exact: true });
  await external.click();

  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from("# Activity destination\n\nOpen this exact file from Project History.\n")
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  let opened = await activityInspectorFor(page, name, new RegExp(`Uploaded .*: ${name}`));
  await page.setViewportSize({ width: 1100, height: 760 });
  await opened.inspector.getByRole("separator", { name: "Resize the inspector" }).press("Home");
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  const destination = opened.inspector.getByRole("button", { name, exact: true });
  await expect(destination).toBeVisible();
  await expect(opened.inspector.getByRole("button", { name: "Open resource", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("linked-external-file-compact-125-percent.png") });
  await destination.click();
  await expect(external).toHaveAttribute("aria-current", "page");
  const fileInspector = page.locator('aside[aria-label="Inspector"]');
  await expect(fileInspector).toHaveAttribute("data-inspected", "external.file");
  await expect(fileInspector.getByText(name, { exact: true }).first()).toBeVisible();

  await fileInspector.getByRole("button", { name: "Delete", exact: true }).click();
  await fileInspector.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(page.getByRole("table").getByRole("button", { name, exact: true })).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  opened = await activityInspectorFor(page, name, new RegExp(`Deleted .* file: ${name}`));
  await expect(opened.inspector.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(opened.inspector.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(opened.inspector.getByRole("button", { name: "Open resource", exact: true })).toHaveCount(0);
  await expect(opened.inspector.getByText("This item is missing, deleted, or otherwise unavailable."))
    .toBeVisible();
  await page.screenshot({ path: info.outputPath("unavailable-external-file-compact-125-percent.png") });
});
