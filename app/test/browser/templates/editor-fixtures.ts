import { expect, type Locator, type Page } from "../fixtures";

export const watchDiagnostics = (page: Page): string[] => {
  const unexpected: string[] = [];
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
  return unexpected;
};

export const tabs = (page: Page) => page.getByRole("toolbar", { name: "Open tabs" });

export const expectStageChrome = async (
  page: Page,
  name: string,
  kind: "Document" | "Presentation"
): Promise<void> => {
  const title = `Template · ${name}`;
  await expect(tabs(page).getByRole("button", { name: title, exact: true })).toBeVisible({
    timeout: 15_000
  });
  const status = page.locator("footer.status-bar .part.start");
  await expect(status.locator(".subject")).toHaveText(title, { timeout: 15_000 });
  await expect(status.locator(".label")).toHaveText(kind);
};

export const openDocumentFixture = async (page: Page): Promise<void> => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tab = tabs(page).getByRole("button", { name: "Winter readiness brief", exact: true });
  if ((await tab.count()) > 0) {
    await tab.click();
  } else {
    await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "Winter readiness brief", exact: true }).first().dblclick();
  }
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(page.locator(".title-bar h1")).toContainText("Winter readiness brief");
};

export const openPresentationFixture = async (page: Page): Promise<void> => {
  const title = "Board review — Q1 exposure";
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tab = tabs(page).getByRole("button", { name: title, exact: true });
  if ((await tab.count()) > 0) {
    await tab.click();
  } else {
    await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: title, exact: true }).first().dblclick();
  }
  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })).toBeVisible();
  await expect(page.locator(".area-title")).toContainText(title);
};

export const templatesPanel = async (page: Page): Promise<Locator> => {
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Templates" })).toBeVisible();
  return context;
};

export const deleteTemplateFromLibrary = async (page: Page, name: string): Promise<void> => {
  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
  const row = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
  await expect(row).toBeVisible();
  await row.click();
  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
  await expect(inspector).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await inspector.getByRole("button", { name: "Delete template" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
};
