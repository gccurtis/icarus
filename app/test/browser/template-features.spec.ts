import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

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

const tabs = (page: Page) => page.getByRole("toolbar", { name: "Open tabs" });

const openDocumentFixture = async (page: Page) => {
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

const openDeckFixture = async (page: Page) => {
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

const templatesPanel = async (page: Page): Promise<Locator> => {
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Templates" })).toBeVisible();
  return context;
};

const deleteTemplateFromLibrary = async (page: Page, name: string) => {
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

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1500, height: 900 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("inserting a template into a document asks for each variable, shows its default, and takes an answer", async ({ page }) => {
  await openDocumentFixture(page);
  const editor = page.locator(".ProseMirror");
  const before = await editor.innerText();

  const context = await templatesPanel(page);
  await context.getByTitle("Insert “Technical glossary” after the current row").click();

  const modal = page.getByRole("dialog", { name: "Insert “Technical glossary”" });
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Source material", { exact: true })).toBeVisible();
  const answer = modal.getByRole("button", { name: "Answer for Source material" });
  await expect(answer).toContainText("Default · Documents, Findings");
  await answer.click();
  await page.getByRole("option", { name: "Winter filings", exact: true }).click();
  await expect(answer).toContainText("Winter filings");
  await modal.getByRole("button", { name: "Insert", exact: true }).click();

  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
  await expect(editor).toContainText("Technical glossary");

  await editor.click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor).not.toContainText("Technical glossary", { timeout: 10_000 });
  expect(await editor.innerText()).toEqual(before);
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 10_000 });
});

test("a document is saved as a template, takes its variable from an inserted prompt, and is saved back", async ({ page }) => {
  const name = `Browser template ${Date.now()}`;
  await openDocumentFixture(page);

  const context = await templatesPanel(page);
  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(context.getByRole("textbox", { name: "New variable" })).toHaveCount(0);
  await expect(context.getByText("A variable appears when a prompt in this template asks for one.")).toBeVisible();

  await context.getByTitle("Insert “Technical glossary” after the current row").click();
  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
  await expect(page.locator(".ProseMirror")).toContainText("Technical glossary");

  const card = context.locator(".variable").filter({ hasText: "Source material" });
  const scope = card.getByRole("button", { name: "Default scope", exact: true });
  await expect(scope).toBeVisible();
  await scope.click();

  const modal = page.getByRole("dialog", { name: "Default scope for Source material" });
  await expect(modal).toBeVisible();
  await modal.getByRole("switch", { name: "Everything in the project" }).click();
  await modal.getByRole("button", { name: "Set the default scope", exact: true }).click();
  await expect(scope).toHaveAttribute("title", /^Everything in the project — /);

  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(context.getByText("Saved to the template.", { exact: true })).toBeVisible({ timeout: 15_000 });

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });

  await deleteTemplateFromLibrary(page, name);
});

test("one slide is saved as a deck template, and a deck template is inserted into an open copy", async ({ page }) => {
  const name = `Browser slide ${Date.now()}`;
  await openDeckFixture(page);

  const context = await templatesPanel(page);
  await expect(context.getByRole("button", { name: "Save slide", exact: true })).toBeDisabled();
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save slide", exact: true }).click();
  await expect(page.locator(".area-title")).toContainText(`Template · ${name}`, { timeout: 15_000 });
  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();

  await context.getByTitle(new RegExp("^Insert “Board review” after slide")).click();
  await expect(context.getByText("Inserted “Board review”.", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });

  await deleteTemplateFromLibrary(page, name);
});

test("the project's resource sets are made, counted, and removed from the Contexts panel", async ({ page }) => {
  const name = `Browser set ${Date.now()}`;
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Context", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Contexts" })).toBeVisible();
  await expect(context.getByRole("button", { name: /^Winter filings/ }).first()).toBeVisible();

  await context.getByRole("button", { name: "New set", exact: true }).click();
  await context.getByRole("textbox", { name: "Set name" }).fill(name);
  await context.getByRole("switch", { name: "Findings", exact: true }).first().click();
  await expect(context.getByText("Findings.", { exact: true })).toBeVisible();
  await context.getByRole("button", { name: "Create", exact: true }).click();

  const made = context.getByRole("button", { name: new RegExp(`^${name}`) }).first();
  await expect(made).toBeVisible();
  await expect(made).toContainText("2 resources");
  await made.click();
  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByTitle(new RegExp(`^Delete “${name}”`)).click();
  await expect(context.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
});
