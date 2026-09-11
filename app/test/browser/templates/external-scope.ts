import { expect, type Page } from "../fixtures";

export const tabs = (page: Page) => page.getByRole("toolbar", { name: "Open tabs" });

export const uploadEvidence = async (page: Page) => {
  await tabs(page).getByRole("button", { name: "External", exact: true }).click();
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles([
    { name: "north-portfolio.md", mimeType: "text/markdown", buffer: Buffer.from("# North portfolio\n\nThe remaining transfer capability is 731 MW. Approve the North transformer replacement on Friday.\n") },
    { name: "south-portfolio.md", mimeType: "text/markdown", buffer: Buffer.from("# South portfolio\n\nThe remaining transfer capability is 842 MW. Defer the South cable renewal until November.\n") }
  ]);
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("2 uploaded · 0 already present · 0 rejected.")).toBeVisible();
};

/** Use the real library dialog, hole binding, resource picker and creation path. */
export const createScopedTemplate = async (page: Page, kind: "document" | "presentation", yard: "north" | "south") => {
  const name = kind === "document" ? "Technical glossary" : "Executive update";
  const hole = kind === "document" ? "Source material" : "Portfolio record";
  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name, exact: true }).first().click();
  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
  await inspector.getByRole("button", { name: "Use template", exact: true }).click();
  const use = page.getByRole("dialog", { name: `Use “${name}”` });
  if (kind === "document") {
    await use.getByRole("tab", { name: /Subject line/ }).click();
    await use.getByRole("textbox", { name: "What Subject line says here" }).fill(`${yard} portfolio`);
  }
  await use.getByRole("tab", { name: new RegExp(hole) }).click();
  await use.locator(".scope").click();
  const builder = page.getByRole("dialog", { name: `What ${hole} selects here` });
  await builder.getByRole("button", { name: "Clear", exact: true }).click();
  await builder.getByRole("button", { name: "Resources", exact: true }).click();
  await builder.locator(".offer").filter({ hasText: `${yard}-portfolio.md` }).getByRole("button", { name: "Add", exact: true }).click();
  await builder.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(use.locator(".scope .rule")).toHaveText(new RegExp(`${yard}-portfolio.md`, "i"));
  await use.getByRole("button", { name: "Create", exact: true }).click();
  const content = kind === "document" ? page.locator(".ProseMirror") : page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  await expect(content).toBeVisible();
  if (kind === "document") await expect(content).toContainText(`Technical glossary · ${yard} portfolio`);
  await page.getByRole("button", { name: "Edit Prompt Block", exact: true }).click();
  const prompt = page.locator(`aside[aria-label="Inspector"][data-inspected="${kind}-editor.prompt-block"]`);
  await expect(prompt.getByRole("button", { name: new RegExp(`${yard}-portfolio.md`, "i") })).toBeVisible();
  const instruction = prompt.getByRole("textbox", { name: "Prompt", exact: true });
  await expect(instruction).not.toBeEmpty();
  // Ask for a verifiable fact, not for an incidental number in an open-ended
  // glossary or executive summary. Both provider modes exercise the same UI.
  await instruction.fill(
    "In at most 40 words, state the remaining transfer capability in MW and the recommended action with its timing. Use only the selected source."
  );
  await prompt.getByRole("button", { name: /^(Refresh|Generate)$/, exact: true }).click();
  const output = kind === "document" ? content.locator('.document-block[data-kind="prompt"]').last() : content.locator("[data-item]").last();
  const included = yard === "north" ? "731" : "842";
  const excluded = yard === "north" ? "842" : "731";
  await expect(output).toContainText(new RegExp(`${included}\\s*MW`), { timeout: 150_000 });
  await expect(output).not.toContainText(excluded);
  await expect(prompt.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled({ timeout: 150_000 });
  await expect(prompt.locator("article").getByRole("button", { name: new RegExp(`${yard}-portfolio.md`, "i") }).first()).toBeVisible();
  return { name, content, output, included, excluded };
};
