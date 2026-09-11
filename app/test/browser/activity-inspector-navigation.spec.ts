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

test("Where opens each current native resource in its owning surface", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  let { tabs, inspector } = await activityInspectorFor(
    page,
    "Winter readiness brief",
    /Edited: Winter readiness brief/
  );
  await inspector.getByRole("button", { name: "Winter readiness brief", exact: true }).click();
  await expect(tabs.getByRole("button", { name: "Winter readiness brief", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  await expect(page.locator(".ProseMirror")).toBeVisible();

  ({ tabs, inspector } = await activityInspectorFor(
    page,
    "Outage minutes by substation",
    /Edited: Outage minutes by substation/
  ));
  await inspector.getByRole("button", { name: "Outage minutes by substation", exact: true }).click();
  await expect(tabs.getByRole("button", { name: "Outage minutes by substation", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.locator(".area-title h1")).toHaveText("Outage minutes by substation");
  await expect(page.locator(".sheet-surface")).toBeVisible();

  ({ tabs, inspector } = await activityInspectorFor(
    page,
    "Board review — Q1 exposure",
    /Edited: Board review — Q1 exposure/
  ));
  await inspector.getByRole("button", { name: "Board review — Q1 exposure", exact: true }).click();
  await expect(tabs.getByRole("button", { name: "Board review — Q1 exposure", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.locator(".area-title h1")).toHaveText("Board review — Q1 exposure");
  await expect(page.locator(".area-canvas")).toBeVisible();

  ({ tabs, inspector } = await activityInspectorFor(
    page,
    "binding winter constraint",
    /Started a research question: What is the binding winter constraint/
  ));
  await inspector.getByRole("button", { name: "Research chat", exact: true }).click();
  await expect(tabs.getByRole("button", { name: "What is the binding winter constraint?", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByPlaceholder("Ask anything about this project")).toBeVisible();
});

test("Where opens Agents details and explains the connector placeholder", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const agents = page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Agents", exact: true });
  const main = page.getByRole("main");

  let { inspector } = await activityInspectorFor(
    page,
    "Grid Analyst",
    /Changed the approach of: Grid Analyst/
  );
  await inspector.getByRole("button", { name: "Grid Analyst", exact: true }).click();
  await expect(agents).toHaveAttribute("aria-current", "page");
  await expect(main.getByLabel("Persona name")).toHaveValue("Grid Analyst");

  ({ inspector } = await activityInspectorFor(
    page,
    "Nightly outage digest — 5 September",
    /Reviewed: Nightly outage digest — 5 September/
  ));
  await inspector
    .getByRole("button", { name: "Nightly outage digest — 5 September", exact: true })
    .click();
  await expect(agents).toHaveAttribute("aria-current", "page");
  await expect(main.getByLabel("Task name")).toHaveValue("Nightly outage digest — 5 September");

  ({ inspector } = await activityInspectorFor(
    page,
    "Assemble the board review pack",
    /Switched off: Assemble the board review pack/
  ));
  await inspector
    .getByRole("button", { name: "Assemble the board review pack", exact: true })
    .click();
  await expect(agents).toHaveAttribute("aria-current", "page");
  await expect(main.getByLabel("Automation name")).toHaveValue("Assemble the board review pack");

  ({ inspector } = await activityInspectorFor(
    page,
    "Google Drive — SCADA outage log",
    /Connected a data source: Google Drive — SCADA outage log/
  ));
  const shown = new Promise<void>((resolve) => {
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Opening connectors is not wired up yet.");
      await dialog.accept();
      resolve();
    });
  });
  await inspector
    .getByRole("button", { name: "Google Drive — SCADA outage log", exact: true })
    .click();
  await shown;
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

  let opened = await activityInspectorFor(page, name, new RegExp(`Uploaded: ${name}`));
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
  opened = await activityInspectorFor(page, name, new RegExp(`Deleted: ${name}`));
  await expect(opened.inspector.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(opened.inspector.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(opened.inspector.getByRole("button", { name: "Open resource", exact: true })).toHaveCount(0);
  await expect(opened.inspector.getByText("This item is missing, deleted, or otherwise unavailable."))
    .toBeVisible();
  await page.screenshot({ path: info.outputPath("unavailable-external-file-compact-125-percent.png") });
});
