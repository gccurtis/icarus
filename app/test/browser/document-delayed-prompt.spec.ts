import { expect, test } from "./fixtures";

test("a document adopts a delayed publication after its initiating request is lost on reload", async ({
  page, request
}) => {
  test.skip(process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1", "Requires the local provider fixture");
  test.setTimeout(180_000);
  const provider = process.env.ICARUS_BROWSER_PROVIDER_ORIGIN;
  const diagnostics: string[] = [];
  let reloading = false;
  page.on("pageerror", (error) => diagnostics.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") diagnostics.push(message.text());
  });
  page.on("requestfailed", (failed) => {
    const expectedAbort = reloading && failed.failure()?.errorText === "net::ERR_ABORTED" &&
      (failed.url().endsWith("/refreshDerivedOutput") || failed.url().includes("/__data.json"));
    if (!expectedAbort) diagnostics.push(`${failed.url()}: ${failed.failure()?.errorText}`);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "External", exact: true }).click();
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name: "delayed-transfer-evidence.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Transfer evidence\n\nThe remaining transfer capability is 764 MW.\n")
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page.locator(".area-editors").getByRole("button", { name: "Document", exact: true }).click();
  const title = page.locator(".title-bar h1");
  await expect(title).toHaveText(/^Untitled document \d+$/);
  const documentTitle = (await title.textContent())!;
  const editor = page.locator(".ProseMirror");
  await editor.locator('.document-block[data-kind="text"]').first().click();
  await page.locator('aside[data-inspected="document-editor.empty-line"]')
    .getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("option", { name: "Prompt", exact: true }).click();
  const inspector = page.locator('aside[data-inspected="document-editor.prompt-block"]');
  const question = "State the remaining transfer capability after the delayed publication.";
  await inspector.getByLabel("Prompt", { exact: true }).fill(question);
  await inspector.locator('button[title="Choose what this prompt reads"]').click();
  const scope = page.getByRole("dialog", { name: "What this prompt reads" });
  await scope.getByRole("button", { name: "Clear", exact: true }).click();
  await scope.getByRole("button", { name: "Resources", exact: true }).click();
  await scope.locator(".offer").filter({ hasText: "delayed-transfer-evidence.md" })
    .getByRole("button", { name: "Add", exact: true }).click();
  await scope.getByRole("button", { name: "Set the scope", exact: true }).click();

  const held = await request.post(`${provider}/control/hold`, { data: { question } });
  expect(held.ok(), await held.text()).toBe(true);
  try {
    await inspector.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(async () => {
      const response = await request.get(`${provider}/state`);
      expect(response.ok()).toBe(true);
      return ((await response.json()) as { barrier: { waiting: number } }).barrier.waiting;
    }, { timeout: 120_000 }).toBe(1);
    await expect(editor.locator('[data-kind="prompt"]')).not.toContainText("764");

    // The provider is still held: the original page cannot receive the result.
    reloading = true;
    await page.reload({ waitUntil: "networkidle" });
    await tabs.getByRole("button", { name: documentTitle, exact: true }).click();
    await expect(title).toHaveText(documentTitle);
    await page.locator('.prompt-pin[data-prompt-block]').click();
    await expect(inspector).toBeVisible();
    const released = await request.post(`${provider}/control/release`);
    expect(released.ok(), await released.text()).toBe(true);

    const block = editor.locator('[data-kind="prompt"]');
    await expect(block).toContainText("764", { timeout: 120_000 });
    await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(block).toContainText("764");
    await page.locator('.prompt-pin[data-prompt-block]').click();
    await expect(inspector.locator("article")).toContainText("remaining transfer capability is 764 MW");
    await page.screenshot({ path: "/tmp/document-delayed-publication.png", fullPage: true });
    expect(diagnostics).toEqual([]);
  } finally {
    const released = await request.post(`${provider}/control/release`);
    expect(released.ok(), await released.text()).toBe(true);
  }
});
