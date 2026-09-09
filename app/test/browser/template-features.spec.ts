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

test("inserting a template into a document asks for each hole, shows its default, and takes an answer", async ({ page }) => {
  await openDocumentFixture(page);
  const editor = page.locator(".ProseMirror");
  const before = await editor.innerText();

  const context = await templatesPanel(page);
  await context.getByTitle("Insert “Technical glossary” after the current row").click();

  const modal = page.getByRole("dialog", { name: "Insert “Technical glossary”" });
  await expect(modal).toBeVisible();

  // Every hole is a tab, and the red ones are the only thing holding Insert up.
  await expect(modal.locator(".tab")).toHaveCount(2);
  await expect(modal.locator(".tab.missing")).toHaveCount(1);

  // One hole at a time, opening on the first.
  await expect(modal.locator(".answer h3")).toHaveText("Source material");
  await expect(modal.locator(".scope .rule")).toContainText("Documents, Findings");

  // Walk to the one that takes words and fill it.
  await modal.getByRole("tab", { name: /Subject line/ }).click();
  await modal.getByRole("textbox", { name: "What Subject line says here" }).fill("Winter terms");
  await expect(modal.locator(".tab.missing")).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Accept all defaults" })).toBeEnabled();

  await modal.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(modal.locator(".answer h3")).toHaveText("Source material");
  await modal.locator(".scope").click();
  const builder = page.getByRole("dialog", { name: "What Source material selects here" });
  await expect(builder).toBeVisible();
  await builder.getByRole("button", { name: "Sets", exact: true }).click();
  await builder
    .locator(".offer")
    .filter({ hasText: "Winter filings" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(builder.getByText("Winter filings").first()).toBeVisible();
  await builder.getByRole("button", { name: "Use this", exact: true }).click();

  await expect(modal.locator(".scope .rule")).toContainText("Winter filings");
  await expect(modal.locator(".scope .tag")).toHaveText("Chosen");
  await modal.getByRole("button", { name: "Insert", exact: true }).click();

  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
  // The words filled the template's own atom, so the heading carries them.
  await expect(editor).toContainText("Technical glossary · Winter terms");

  await editor.click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor).not.toContainText("Technical glossary", { timeout: 10_000 });
  expect(await editor.innerText()).toEqual(before);
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 10_000 });
});

test("a document is saved as a template, takes its hole from an inserted prompt, and is saved back", async ({ page }) => {
  const name = `Browser template ${Date.now()}`;
  await openDocumentFixture(page);

  const context = await templatesPanel(page);
  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(context.getByRole("textbox", { name: "New variable" })).toHaveCount(0);
  await expect(context.getByText("Nothing here is a hole yet.")).toBeVisible();
  await expect(context.locator(".hole")).toHaveCount(0);

  await context.getByTitle("Insert “Technical glossary” after the current row").click();
  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
  await expect(page.locator(".ProseMirror")).toContainText("Technical glossary");

  const card = context.locator(".hole").filter({ hasText: "Source material" });
  const scope = card.getByRole("button", { name: "Default scope", exact: true });
  await expect(scope).toBeVisible();
  await scope.click();

  const modal = page.getByRole("dialog", { name: "Default scope for Source material" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Whole project", exact: true }).click();
  await modal.getByRole("button", { name: "Set the default scope", exact: true }).click();
  await expect(scope).toHaveAttribute("title", /^Everything in the project — /);

  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(context.getByText("Saved to the template.", { exact: true })).toBeVisible({ timeout: 15_000 });

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });

  await deleteTemplateFromLibrary(page, name);
});

/**
 * The whole chain, from a prompt somebody writes to a copy that reads what
 * somebody else chose. One gesture makes the hole; everything after it follows.
 */
test("a templateified prompt becomes a hole the template asks about", async ({ page }) => {
  const name = `Browser prompt ${Date.now()}`;

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).locator('button.tab.icon[aria-label="New tab"]').click();
  await page.locator(".area-editors").getByRole("button", { name: "Document", exact: true }).click();

  const editor = page.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await editor.locator('.document-block[data-kind="text"]').first().click();
  const empty = page.locator('aside[aria-label="Inspector"][data-inspected="document-editor.empty-line"]');
  await empty.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("option", { name: "Prompt", exact: true }).click();

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(inspector).toBeVisible();
  await inspector.getByLabel("Prompt").fill("Summarize the winter filings.");

  // The Scope control is real: it reads the whole project and opens the builder.
  await expect(inspector.getByRole("button", { name: "Everything in the project" })).toBeVisible();

  // Until Templateify is pressed this is not a hole.
  await expect(inspector.getByRole("button", { name: "Templateify", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Templateify", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Hole 1", exact: true })).toBeVisible();

  await inspector.getByRole("button", { name: "Hole 1", exact: true }).click();
  const holeName = inspector.getByRole("textbox", { name: "What this hole is called" });
  await holeName.fill("winter_sources");
  await holeName.press("Enter");
  await expect(inspector.getByRole("button", { name: "winter_sources", exact: true })).toBeVisible();

  await inspector.getByRole("button", { name: "What whoever places this is choosing" }).click();
  const holeMeans = inspector.getByRole("textbox", { name: "What this hole stands for" });
  await holeMeans.fill("Which filings the summary reads");
  await holeMeans.blur();
  await expect(
    inspector.getByRole("button", { name: "Which filings the summary reads", exact: true })
  ).toBeVisible();

  // Save it as a template.
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });
  const context = await templatesPanel(page);
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  // The prompt is a hole, named and described, defaulting to what it read.
  const card = context.locator(".hole").filter({ hasText: "winter_sources" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Which filings the summary reads");
  await expect(card.getByRole("button", { name: "Default scope", exact: true })).toHaveAttribute(
    "title",
    /^Everything in the project/
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, {
    timeout: 15_000
  });

  // Placing it asks about that prompt, and takes an answer for it.
  await openDocumentFixture(page);
  const panel = await templatesPanel(page);
  await panel.getByTitle(`Insert “${name}” after the current row`).click();

  const modal = page.getByRole("dialog", { name: `Insert “${name}”` });
  await expect(modal).toBeVisible();
  await expect(modal.locator(".answer h3")).toHaveText("winter_sources");
  await expect(modal.locator(".means")).toHaveText("Which filings the summary reads");
  await expect(modal.locator(".tab.missing")).toHaveCount(0);
  await expect(modal.locator(".scope .tag")).toHaveText("Default");
  await expect(modal.locator(".scope .rule")).toContainText("Everything in the project");

  await modal.locator(".scope").click();
  const builder = page.getByRole("dialog", { name: "What winter_sources selects here" });
  await expect(builder).toBeVisible();
  await builder.getByRole("button", { name: "Kinds", exact: true }).click();
  await builder
    .locator(".offer")
    .filter({ hasText: "Findings" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await builder.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(modal.locator(".scope .tag")).toHaveText("Chosen");

  await modal.getByRole("button", { name: "Insert", exact: true }).click();
  await expect(panel.getByText(`Inserted “${name}”.`, { exact: true })).toBeVisible();

  await deleteTemplateFromLibrary(page, name);
});

test("Templateify turns a run of selected text into a hole that says those words", async ({ page }) => {
  const name = `Browser holes ${Date.now()}`;
  await openDocumentFixture(page);

  // Select a word in the prose, and the selection inspector offers to make it a hole.
  const editor = page.locator(".ProseMirror");
  const paragraph = editor.getByRole("paragraph").first();
  await expect(paragraph).toBeVisible();
  await paragraph.dblclick();

  const selection = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(selection).toBeVisible();
  const words = ((await page.evaluate(() => window.getSelection()?.toString())) ?? "").trim();
  expect(words.length).toBeGreaterThan(0);

  await selection.getByRole("button", { name: "Templateify", exact: true }).click();
  await expect(editor.locator(".document-template-atom")).toContainText("Hole 1");
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });

  // The words are not thrown away — they become what the hole says by default.
  const context = await templatesPanel(page);
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  const card = context.locator(".hole").filter({ hasText: "Hole 1" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Default scope", exact: true })).toHaveCount(0);
  await expect(card).toContainText(words);

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
  await context.getByRole("button", { name: "Choose what it selects", exact: true }).click();

  const builder = page.getByRole("dialog", { name: "A set of resources" });
  await expect(builder).toBeVisible();
  await builder
    .locator(".offer")
    .filter({ hasText: "Findings" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(builder.getByText("Findings", { exact: true }).first()).toBeVisible();
  await builder.getByRole("button", { name: "Use this", exact: true }).click();

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

test("a hole's default is built with an exclusion, stored, and read back as the rule", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: /^Incident write-up/ }).first().click();

  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
  await expect(inspector).toBeVisible();
  await inspector.getByText("Incident evidence", { exact: true }).click();

  const scope = inspector.getByRole("button", { name: "Default scope", exact: true }).first();
  await expect(scope).toBeVisible();

  // The seeded default is a bound row, so the builder opens on the rule it holds.
  await expect(scope).toHaveAttribute("title", /minus Interconnect glossary/);
  await scope.click();

  const builder = page.getByRole("dialog", { name: "Default scope for Incident evidence" });
  await expect(builder).toBeVisible();

  // One term, one row: the stored rule's three kinds are three rows, not one.
  await expect(builder.locator(".term")).toHaveCount(3);

  await builder.getByRole("button", { name: /^Exclude/ }).click();
  await expect(builder.locator(".term")).toHaveCount(1);
  await builder.getByRole("button", { name: "Resources", exact: true }).click();
  await builder
    .locator(".offer")
    .filter({ hasText: "Substation 14 incident write-up" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await builder.getByRole("button", { name: "Set the default scope", exact: true }).click();

  await expect(scope).toHaveAttribute(
    "title",
    /minus Interconnect glossary and Substation 14 incident write-up/,
    { timeout: 15_000 }
  );

  // Put the seeded template back the way the fixture had it.
  await scope.click();
  await expect(builder).toBeVisible();
  await builder.getByRole("button", { name: /^Exclude/ }).click();
  await builder
    .locator(".term")
    .filter({ hasText: "Substation 14 incident write-up" })
    .getByRole("button", { name: "×" })
    .click();
  await builder.getByRole("button", { name: "Set the default scope", exact: true }).click();
  await expect(scope).not.toHaveAttribute("title", /Substation 14 incident write-up/, {
    timeout: 15_000
  });
  await expect(scope).toHaveAttribute("title", /minus Interconnect glossary/);
});
