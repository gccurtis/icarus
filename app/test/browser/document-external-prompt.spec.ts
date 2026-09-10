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

test.beforeEach(async ({ page }) => {
  unexpected = [];
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1500, height: 950 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("a directly authored document Prompt Block reads one exact uploaded External file", async ({
  page
}) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "External", exact: true }).click();
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name: "document-prompt-evidence.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Imported transfer evidence\n\nThe remaining transfer capability is 764 MW for the direct document scenario.\n"
    )
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page
    .locator(".area-editors")
    .getByRole("button", { name: "Document", exact: true })
    .click();

  const title = page.locator(".title-bar h1");
  await expect(title).toHaveText(/^Untitled document \d+$/);
  const documentTitle = (await title.textContent()) ?? "";
  const editor = page.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await editor.locator('.document-block[data-kind="text"]').first().click();

  const emptyInspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.empty-line"]'
  );
  await emptyInspector.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("option", { name: "Prompt", exact: true }).click();

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(inspector).toBeVisible();
  await inspector
    .getByLabel("Prompt", { exact: true })
    .fill("State the remaining transfer capability in the selected imported source.");

  await inspector.locator('button[title="Choose what this prompt reads"]').click();
  const scope = page.getByRole("dialog", { name: "What this prompt reads" });
  await scope.getByRole("button", { name: "Clear", exact: true }).click();
  await scope.getByRole("button", { name: "Resources", exact: true }).click();
  const external = scope.locator(".offer").filter({ hasText: "document-prompt-evidence.md" });
  await expect(external).toBeVisible();
  await external.getByRole("button", { name: "Add", exact: true }).click();
  await scope.getByRole("button", { name: "Set the scope", exact: true }).click();
  await expect(
    inspector.locator('button[title="Choose what this prompt reads"]')
  ).toHaveText(/document-prompt-evidence\.md/i);

  await inspector.getByRole("button", { name: "Generate", exact: true }).click();
  const generated = editor.locator('.document-block[data-kind="prompt"]').last();
  await expect(generated).toContainText("remaining transfer capability is 764 MW", {
    timeout: 150_000
  });
  await expect(generated).not.toContainText("Protection isolated the transformer bank");

  await expect(inspector.getByRole("button", { name: "Evidence", exact: true })).toBeVisible();
  const evidence = inspector.locator("article").filter({
    hasText: /remaining transfer capability is 764 MW/i
  });
  await expect(evidence).not.toContainText("Protection isolated the transformer bank");
  const evidenceSource = evidence.getByRole("button", {
    name: /document-prompt-evidence\.md/i
  });
  await expect(evidenceSource).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();

  await evidenceSource.click();
  const externalTab = tabs.getByRole("button", { name: "External", exact: true });
  await expect(externalTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "External", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Inspector" })
      .getByText("document-prompt-evidence.md", { exact: true })
      .first()
  ).toBeVisible();

  await tabs.getByRole("button", { name: documentTitle, exact: true }).click();
  await expect(editor.locator('.document-block[data-kind="prompt"]').last()).toContainText(
    "remaining transfer capability is 764 MW"
  );

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".title-bar h1")).toHaveText(documentTitle);
  await expect(editor.locator('.document-block[data-kind="prompt"]').last()).toContainText(
    "remaining transfer capability is 764 MW"
  );
  await page.getByRole("button", { name: "Edit Prompt Block", exact: true }).last().click();
  const reloadedInspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(
    reloadedInspector.locator('button[title="Choose what this prompt reads"]')
  ).toHaveText(/document-prompt-evidence\.md/i);
  await expect(
    reloadedInspector
      .locator("article")
      .filter({ hasText: /remaining transfer capability is 764 MW/i })
      .getByRole("button", { name: /document-prompt-evidence\.md/i })
  ).toBeVisible();
});
