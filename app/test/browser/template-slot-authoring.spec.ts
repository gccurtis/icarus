import { expect, test, type TestInfo } from "./fixtures";
import {
  deleteTemplateFromLibrary,
  openDocumentFixture,
  openPresentationFixture,
  tabs,
  templatesPanel,
  watchDiagnostics
} from "./templates/editor-fixtures";

let unexpected: string[] = [];

test.beforeEach(async ({ page }) => {
  unexpected = watchDiagnostics(page);
  await page.setViewportSize({ width: 1500, height: 900 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("a prompt can become a slot only inside its template stage", async ({ page }) => {
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
  await expect(inspector.getByRole("button", { name: "Everything in the project" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Template", exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Make slot", exact: true })).toHaveCount(0);

  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });
  const context = await templatesPanel(page);
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });
  await page.getByRole("button", { name: "Edit Prompt Block", exact: true }).last().click();
  const stagedPrompt = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await stagedPrompt.getByRole("button", { name: "Template", exact: true }).click();
  await stagedPrompt.getByRole("button", { name: "Make slot", exact: true }).click();
  await expect(stagedPrompt.getByText("Slot 1", { exact: true })).toBeVisible();

  let card = context.locator(".slot").filter({ hasText: "Slot 1" });
  await expect(card).toBeVisible();
  await card.locator(".slot-target").click();
  await expect(stagedPrompt).toBeVisible();

  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(context.getByText("Saved to the template.", { exact: true })).toBeVisible({
    timeout: 15_000
  });
  card = context.locator(".slot").filter({ hasText: "Slot 1" });
  await card.getByRole("button", { name: "What this slot stands for" }).click();
  const slotMeans = card.getByRole("textbox", { name: "Description for Slot 1" });
  await slotMeans.fill("Which filings the summary reads");
  await slotMeans.blur();
  await expect(
    card.getByRole("button", { name: "Which filings the summary reads", exact: true })
  ).toBeVisible();
  await expect(card.getByRole("button", { name: "Default scope", exact: true })).toHaveAttribute(
    "title",
    /^Everything in the project/
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, {
    timeout: 15_000
  });

  await openDocumentFixture(page);
  const panel = await templatesPanel(page);
  await panel.getByTitle(`Insert “${name}” after the current row`).click();
  const modal = page.getByRole("dialog", { name: `Insert “${name}”` });
  await expect(modal.locator(".answer h3")).toHaveText("Slot 1");
  await expect(modal.locator(".means")).toHaveText("Which filings the summary reads");
  await expect(modal.locator(".tab.missing")).toHaveCount(0);
  await expect(modal.locator(".scope .tag")).toHaveText("Default");

  await modal.locator(".scope").click();
  const builder = page.getByRole("dialog", { name: "What Slot 1 selects here" });
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

test("a template-stage text slot appears immediately and remains selected", async ({ page }) => {
  const name = `Browser slots ${Date.now()}`;
  await openDocumentFixture(page);

  const editor = page.locator(".ProseMirror");
  let paragraph = editor.getByRole("paragraph").first();
  const original = await editor.innerText();
  await paragraph.dblclick();
  let selection = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(selection.getByRole("button", { name: "Template", exact: true })).toHaveCount(0);

  const context = await templatesPanel(page);
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  const stagedEditor = page.locator(".ProseMirror");
  paragraph = stagedEditor.getByRole("paragraph").first();
  await paragraph.dblclick();
  selection = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  const words = ((await page.evaluate(() => window.getSelection()?.toString())) ?? "").trim();
  expect(words.length).toBeGreaterThan(0);
  await expect(selection.getByRole("button", { name: "Make slot", exact: true })).toHaveCount(0);
  await selection.getByRole("button", { name: "Template", exact: true }).click();
  await selection.getByRole("button", { name: "Make slot", exact: true }).click();

  await expect(selection).toBeVisible();
  await expect(selection.getByText("Slot 1", { exact: true })).toBeVisible();
  await expect(selection.locator("blockquote").last()).toContainText(words);
  await expect(stagedEditor.locator(".document-template-atom")).toHaveCount(0);
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });

  const card = context.locator(".slot").filter({ hasText: "Slot 1" });
  await expect(card).toBeVisible();
  await card.locator(".slot-target").click();
  await expect(selection).toBeVisible();
  expect(((await page.evaluate(() => window.getSelection()?.toString())) ?? "").trim()).toBe(words);

  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(context.getByText("Saved to the template.", { exact: true })).toBeVisible({
    timeout: 15_000
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();

  await openDocumentFixture(page);
  expect(await page.locator(".ProseMirror").innerText()).toEqual(original);
  await expect(page.locator(".ProseMirror").locator(".document-template-atom")).toHaveCount(0);
  await deleteTemplateFromLibrary(page, name);
});

test("document and presentation templates share one project name namespace", async ({ page }) => {
  const name = `Shared template name ${Date.now()}`;
  await openDocumentFixture(page);
  let context = await templatesPanel(page);
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await openPresentationFixture(page);
  context = await templatesPanel(page);
  await context.getByRole("textbox", { name: "Template name" }).fill(name.toLocaleUpperCase());
  await context.getByRole("button", { name: "Save presentation", exact: true }).click();
  await expect(context.getByText(/already exists in this project/)).toBeVisible();
  await expect(page.locator(".area-title")).not.toContainText("Template ·");

  await deleteTemplateFromLibrary(page, name);
});

test("a presentation stage keeps text selected while it creates live slots", async ({ page }) => {
  const name = `Browser presentation slots ${Date.now()}`;
  await openPresentationFixture(page);
  const templates = await templatesPanel(page);
  await templates.getByRole("textbox", { name: "Template name" }).fill(name);
  await templates.getByRole("button", { name: "Save presentation", exact: true }).click();
  await expect(page.locator(".area-title")).toContainText(`Template · ${name}`, { timeout: 15_000 });

  const context = page.locator('aside[aria-label="Context"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');
  const surface = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  const rail = context.getByRole("navigation", { name: "Context views" });

  await rail.getByRole("button", { name: "Insert", exact: true }).click();
  await context.getByRole("button", { name: "Text box", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.text-box");
  await inspector.getByRole("button", { name: "Prompt", exact: true }).click();
  const prompt = page.locator(
    'aside[aria-label="Inspector"][data-inspected="presentation-editor.prompt-block"]'
  );
  await prompt.getByLabel("Prompt", { exact: true }).fill("Summarize the winter exposure.");
  await prompt.getByRole("button", { name: "Template", exact: true }).click();
  await prompt.getByRole("button", { name: "Make slot", exact: true }).click();
  await expect(prompt.getByText("Slot 1", { exact: true })).toBeVisible();
  await rail.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(templates.locator(".slot").filter({ hasText: "Slot 1" })).toBeVisible();

  await rail.getByRole("button", { name: "Insert", exact: true }).click();
  await context.getByRole("button", { name: "Text box", exact: true }).click();
  const words = surface.locator("[data-item]").last();
  await words.dblclick({ position: { x: 24, y: 18 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");

  const selection = page.locator(
    'aside[aria-label="Inspector"][data-inspected="presentation-editor.text-selection"]'
  );
  const selectedWords = ((await page.evaluate(() => window.getSelection()?.toString())) ?? "").trim();
  await selection.getByRole("button", { name: "Template", exact: true }).click();
  await selection.getByRole("button", { name: "Make slot", exact: true }).click();
  await expect(selection.getByText("Slot 2", { exact: true })).toBeVisible();
  await expect(selection.locator("blockquote").last()).toContainText(selectedWords);
  expect(((await page.evaluate(() => window.getSelection()?.toString())) ?? "").trim()).toBe(selectedWords);
  await expect(words).toContainText("Text");
  await expect(words).not.toContainText("{Slot");

  await rail.getByRole("button", { name: "Templates", exact: true }).click();
  const second = templates.locator(".slot").filter({ hasText: "Slot 2" });
  await second.locator(".slot-target").click();
  await expect(selection).toBeVisible();
  expect(((await page.evaluate(() => window.getSelection()?.toString())) ?? "").trim()).toBe(selectedWords);

  await templates.getByRole("button", { name: "Save", exact: true }).click();
  await expect(templates.getByText("Saved to the template.", { exact: true })).toBeVisible({
    timeout: 15_000
  });
  await expect(templates.locator(".slot").filter({ hasText: "Slot 1" })).toBeVisible();
  await expect(templates.locator(".slot").filter({ hasText: "Slot 2" })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await templates.getByRole("button", { name: "Discard", exact: true }).click();
  await deleteTemplateFromLibrary(page, name);
});
