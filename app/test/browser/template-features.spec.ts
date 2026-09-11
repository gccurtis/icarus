import { expect, test, type TestInfo } from "./fixtures";
import {
  deleteTemplateFromLibrary,
  expectStageChrome,
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

test("inserting a template into a document asks for each slot, shows its default, and takes an answer", async ({ page }) => {
  await openDocumentFixture(page);
  const editor = page.locator(".ProseMirror");
  const before = await editor.innerText();

  const context = await templatesPanel(page);
  await context.getByTitle("Insert “Technical glossary” after the current row").click();

  const modal = page.getByRole("dialog", { name: "Insert “Technical glossary”" });
  await expect(modal).toBeVisible();

  // Every slot is a tab, and the red ones are the only thing holding Insert up.
  await expect(modal.locator(".tab")).toHaveCount(2);
  await expect(modal.locator(".tab.missing")).toHaveCount(1);

  // One slot at a time, opening on the first.
  await expect(modal.locator(".answer h3")).toHaveText("Source material");
  await expect(modal.locator(".scope .rule")).toContainText("Interconnect glossary");

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

test("a document is saved as a template, takes its slot from an inserted prompt, and is saved back", async ({ page }) => {
  const name = `Browser template ${Date.now()}`;
  await openDocumentFixture(page);

  const context = await templatesPanel(page);
  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await context.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });
  await expectStageChrome(page, name, "Document");

  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(context.getByRole("textbox", { name: "New variable" })).toHaveCount(0);
  await expect(context.getByText("No slots", { exact: true })).toBeVisible();
  await expect(context.locator(".slot")).toHaveCount(0);

  await context.getByTitle("Insert “Technical glossary” after the current row").click();
  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
  await expect(page.locator(".ProseMirror")).toContainText("Technical glossary");

  const card = context.locator(".slot").filter({ hasText: "Source material" });
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
 * somebody else chose. One gesture makes the slot; everything after it follows.
 */
test("one slide is saved as a presentation template, and a presentation template is inserted into an open copy", async ({ page }) => {
  const name = `Browser slide ${Date.now()}`;
  await openPresentationFixture(page);

  const context = await templatesPanel(page);
  const savePresentation = context.getByRole("button", { name: "Save presentation", exact: true });
  const saveSlide = context.getByRole("button", { name: "Save slide", exact: true });
  await expect(saveSlide).toBeDisabled();
  const wholeBox = await savePresentation.boundingBox();
  const slideBox = await saveSlide.boundingBox();
  expect(wholeBox).not.toBeNull();
  expect(slideBox).not.toBeNull();
  expect(Math.abs(wholeBox!.x - slideBox!.x)).toBeLessThan(2);
  expect(slideBox!.y).toBeGreaterThanOrEqual(wholeBox!.y + wholeBox!.height);
  await context.getByRole("textbox", { name: "Template name" }).fill(name);
  await saveSlide.click();
  await expect(page.locator(".area-title")).toContainText(`Template · ${name}`, { timeout: 15_000 });
  await expectStageChrome(page, name, "Presentation");
  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();

  await context.getByTitle(new RegExp("^Insert “Board review” after slide")).click();
  await expect(context.getByText("Inserted “Board review”.", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await context.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });

  await deleteTemplateFromLibrary(page, name);
});

test("a committed template fills text and generates only from its default file", async ({ page }) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "Technical glossary", exact: true }).first().click();

  const libraryInspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="templates.template"]'
  );
  await libraryInspector.getByRole("button", { name: "Use template", exact: true }).click();
  const use = page.getByRole("dialog", { name: "Use “Technical glossary”" });
  await expect(use.locator(".scope .rule")).toHaveText("Interconnect glossary");
  await use.getByRole("tab", { name: /Subject line/ }).click();
  await use
    .getByRole("textbox", { name: "What Subject line says here" })
    .fill("Default source terms");
  await use.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.locator(".ProseMirror")).toContainText(
    "Technical glossary · Default source terms"
  );
  await page.getByRole("button", { name: "Edit Prompt Block", exact: true }).click();
  const prompt = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(
    prompt.getByRole("button", { name: "Interconnect glossary", exact: true })
  ).toBeVisible();
  await expect(
    prompt.getByRole("button", { name: "Substation 14 incident write-up", exact: true })
  ).toHaveCount(0);

  const refresh = prompt.getByRole("button", { name: "Refresh", exact: true });
  await refresh.click();
  const generated = page.locator('.document-block[data-kind="prompt"]').last();
  await expect(generated).toContainText("remaining transfer capability", {
    timeout: 150_000
  });
  await expect(generated).not.toContainText("Protection isolated the transformer bank");

  await page.reload({ waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .locator(".area-resources")
    .getByRole("button", { name: "Technical glossary", exact: true })
    .first()
    .dblclick();
  await expect(page.locator(".ProseMirror")).toContainText(
    "Technical glossary · Default source terms"
  );
  await expect(page.locator('.document-block[data-kind="prompt"]').last()).toContainText(
    "remaining transfer capability"
  );
});

test("a committed template fills text and generates only from its replacement file", async ({ page }) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "Technical glossary", exact: true }).first().click();

  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
  await expect(inspector).toBeVisible();
  await inspector.getByRole("button", { name: "Use template", exact: true }).click();

  const use = page.getByRole("dialog", { name: "Use “Technical glossary”" });
  await expect(use).toBeVisible();
  await expect(use.locator(".scope .rule")).toHaveText("Interconnect glossary");

  await use.getByRole("tab", { name: /Subject line/ }).click();
  await use
    .getByRole("textbox", { name: "What Subject line says here" })
    .fill("Substation response terms");
  await use.getByRole("tab", { name: /Source material/ }).click();
  await use.locator(".scope").click();

  const builder = page.getByRole("dialog", { name: "What Source material selects here" });
  await expect(builder).toBeVisible();
  await expect(builder.locator(".term").filter({ hasText: "Interconnect glossary" })).toHaveCount(1);
  await builder
    .locator(".term")
    .filter({ hasText: "Interconnect glossary" })
    .getByRole("button", { name: "×" })
    .click();
  await builder.getByRole("button", { name: "Resources", exact: true }).click();
  await builder
    .locator(".offer")
    .filter({ hasText: "Substation 14 incident write-up" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(
    builder.locator(".term").filter({ hasText: "Substation 14 incident write-up" })
  ).toHaveCount(1);
  await expect(builder.locator(".term").filter({ hasText: "Interconnect glossary" })).toHaveCount(0);
  await builder.getByRole("button", { name: "Use this", exact: true }).click();

  await expect(use.locator(".scope .tag")).toHaveText("Chosen");
  await expect(use.locator(".scope .rule")).toHaveText("Substation 14 incident write-up");
  await use.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.locator(".title-bar h1")).toHaveText("Technical glossary");
  await expect(page.locator(".ProseMirror")).toContainText(
    "Technical glossary · Substation response terms"
  );
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });

  await page.reload({ waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .locator(".area-resources")
    .getByRole("button", { name: "Technical glossary", exact: true })
    .first()
    .dblclick();
  await expect(page.locator(".ProseMirror")).toContainText(
    "Technical glossary · Substation response terms"
  );

  await page.getByRole("button", { name: "Edit Prompt Block", exact: true }).click();
  const prompt = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(prompt).toBeVisible();
  await expect(
    prompt.getByRole("button", { name: "Substation 14 incident write-up", exact: true })
  ).toBeVisible();
  await expect(
    prompt.getByRole("button", { name: "Interconnect glossary", exact: true })
  ).toHaveCount(0);

  const refresh = prompt.getByRole("button", { name: "Refresh", exact: true });
  await expect(refresh).toBeEnabled();
  await refresh.click();

  const generated = page.locator('.document-block[data-kind="prompt"]').last();
  await expect(generated).toContainText(
    "Protection isolated the transformer bank at 14:18",
    { timeout: 150_000 }
  );
  await expect(generated).not.toContainText("remaining transfer capability");
  await expect(refresh).toBeEnabled({ timeout: 150_000 });
  await expect(
    prompt.locator('button[title="Choose what this prompt reads"]')
  ).toHaveText("Substation 14 incident write-up");
  await expect(
    prompt.getByRole("button", { name: "Interconnect glossary", exact: true })
  ).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .locator(".area-resources")
    .getByRole("button", { name: "Technical glossary", exact: true })
    .first()
    .dblclick();
  await expect(page.locator('.document-block[data-kind="prompt"]').last()).toContainText(
    "Protection isolated the transformer bank at 14:18"
  );
});

test("a template scope can choose an uploaded External file and ground its Prompt Block", async ({ page }) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "External Files", exact: true }).click();
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name: "external-grounding.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Imported operating limit\n\nThe remaining transfer capability is 731 MW after imports.\n"
    )
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "Technical glossary", exact: true }).first().click();
  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="templates.template"]'
  );
  await inspector.getByRole("button", { name: "Use template", exact: true }).click();

  const use = page.getByRole("dialog", { name: "Use “Technical glossary”" });
  await use.getByRole("tab", { name: /Subject line/ }).click();
  await use
    .getByRole("textbox", { name: "What Subject line says here" })
    .fill("Imported operating limit");
  await use.getByRole("tab", { name: /Source material/ }).click();
  await use.locator(".scope").click();

  const builder = page.getByRole("dialog", { name: "What Source material selects here" });
  await builder
    .locator(".term")
    .filter({ hasText: "Interconnect glossary" })
    .getByRole("button", { name: "×" })
    .click();
  await builder.getByRole("button", { name: "Resources", exact: true }).click();
  const external = builder.locator(".offer").filter({ hasText: "external-grounding.md" });
  await expect(external).toBeVisible();
  await external.getByRole("button", { name: "Add", exact: true }).click();
  await builder.getByRole("button", { name: "Use this", exact: true }).click();

  await expect(use.locator(".scope .rule")).toHaveText(/external-grounding\.md/i);
  await use.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toContainText(
    "Technical glossary · Imported operating limit"
  );

  await page.getByRole("button", { name: "Edit Prompt Block", exact: true }).click();
  const prompt = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(
    prompt.getByRole("button", { name: /external-grounding\.md/i })
  ).toBeVisible();
  const refresh = prompt.getByRole("button", { name: "Refresh", exact: true });
  await refresh.click();
  const generated = page.locator('.document-block[data-kind="prompt"]').last();
  await expect(generated).toContainText("remaining transfer capability is 731 MW", {
    timeout: 150_000
  });
  await expect(generated).not.toContainText("Protection isolated the transformer bank");
  await expect(refresh).toBeEnabled({ timeout: 150_000 });

  await page.reload({ waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .locator(".area-resources")
    .getByRole("button", { name: "Technical glossary", exact: true })
    .first()
    .dblclick();
  await expect(page.locator('.document-block[data-kind="prompt"]').last()).toContainText(
    "remaining transfer capability is 731 MW"
  );
});

test("a slot's default is built with an exclusion, stored, and read back as the rule", async ({ page }) => {
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
