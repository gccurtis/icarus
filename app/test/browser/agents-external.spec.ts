import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Page, type TestInfo } from "./fixtures";
import { workspaceLandingSaved } from "./workspace-persistence";

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

const tabs = (page: Page) => page.getByRole("toolbar", { name: "Open tabs" });

test.beforeEach(async ({ page }) => {
  unexpected = [];
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1500, height: 950 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("duplicate External file names are selected and restored by exact relative path", async ({
  page
}) => {
  const temporary = await mkdtemp(join(tmpdir(), "icarus-agent-scope-path-"));
  const folder = join(temporary, "inspection-bundle");
  try {
    await mkdir(join(folder, "north"), { recursive: true });
    await mkdir(join(folder, "south"), { recursive: true });
    await writeFile(join(folder, "north", "inspection.md"), "# North inspection\n\n67 C under load.\n");
    await writeFile(join(folder, "south", "inspection.md"), "# South inspection\n\nFan delay observed.\n");

    await page.goto("/app/dev-project", { waitUntil: "networkidle" });
    await tabs(page).getByRole("button", { name: "External", exact: true }).click();
    await page.locator('form.upload-form input[type="file"]').nth(1).setInputFiles(folder);
    await page.getByRole("button", { name: "Upload folder", exact: true }).click();
    await expect(page.getByText("2 uploaded · 0 already present · 0 rejected."))
      .toBeVisible({ timeout: 30_000 });

    await tabs(page).getByRole("button", { name: "Agents", exact: true }).click();
    const personaLanding = workspaceLandingSaved(page, {
      tab: "agents",
      content: "agents.persona"
    });
    await page.locator(".area-create").getByRole("button", { name: "Persona", exact: true }).click();
    const main = page.getByRole("main");
    await main.getByRole("button", { name: "Add resource", exact: true }).click();
    const northPath = "inspection-bundle/north/inspection.md";
    const southPath = "inspection-bundle/south/inspection.md";
    await expect(page.getByRole("menuitem").filter({ hasText: northPath })).toHaveCount(1);
    await expect(page.getByRole("menuitem").filter({ hasText: southPath })).toHaveCount(1);
    await page.getByRole("menuitem").filter({ hasText: northPath }).click();

    const scope = main.locator("ul.scope");
    await expect(scope.getByText(northPath, { exact: true })).toBeVisible();
    await expect(scope.getByText(southPath, { exact: true })).toHaveCount(0);
    await personaLanding;
    await page.reload({ waitUntil: "networkidle" });
    await expect(scope.getByText(northPath, { exact: true })).toBeVisible();
    await expect(scope.getByText(southPath, { exact: true })).toHaveCount(0);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("an agent task inherits one exact uploaded External resource and protects it from deletion", async ({
  page
}) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await tabs(page).getByRole("button", { name: "External", exact: true }).click();
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name: "agent-evidence.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Transformer evidence\n\nThe verified emergency transformer limit is 913 MVA.\n"
    )
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  await tabs(page).getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  const personaLanding = workspaceLandingSaved(page, {
    tab: "agents",
    content: "agents.persona"
  });
  await page.locator(".area-create").getByRole("button", { name: "Persona", exact: true }).click();
  const main = page.getByRole("main");
  await expect(main.getByLabel("Persona name")).toHaveValue("Untitled persona");
  await personaLanding;

  await main.getByRole("button", { name: "Add resource", exact: true }).click();
  await page.getByRole("menuitem", { name: /agent-evidence\.md/i }).click();
  await expect(main.locator("ul.scope").getByText(/agent-evidence\.md/i)).toBeVisible();
  await expect(main.locator("ul.scope").getByText("Everything in this project", { exact: true }))
    .toHaveCount(0);

  await main.getByRole("button", { name: "New task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ask a persona to do something once" })).toBeVisible();
  await expect(main.locator("ul.scope").getByText(/agent-evidence\.md/i)).toBeVisible();
  await main.getByLabel("Task name").fill("Verify imported transformer limit");
  await main
    .getByLabel("Instruction", { exact: true })
    .fill("Read the selected External file and report its verified transformer limit.");
  const taskLanding = workspaceLandingSaved(page, {
    tab: "agents",
    content: "agents.task",
    focus: (value) => value !== null && value !== "new" && !value.startsWith("new:")
  });
  await main.getByRole("button", { name: "Create and start", exact: true }).click();

  await expect(main.getByLabel("Task name")).toHaveValue("Verify imported transformer limit");
  await expect(main.locator("ul.scope").getByText(/agent-evidence\.md/i)).toBeVisible();
  await expect(main.locator("ul.scope").getByText("Everything in this project", { exact: true }))
    .toHaveCount(0);
  const answer =
    "The imported evidence reports a verified emergency transformer limit of 913 MVA.";
  await expect(main.getByText("Pending review", { exact: true })).toBeVisible({
    timeout: 150_000
  });
  await expect(main.getByText("1 resource prepared", { exact: true })).toBeVisible();
  await expect(main.getByRole("list", { name: "Conversation" }).getByText(answer, {
    exact: true
  })).toBeVisible();
  const outputs = main.getByRole("list", { name: "Outputs" });
  await expect(outputs.getByRole("listitem").filter({ hasText: "Grounded answer" }))
    .toContainText("913 MVA");
  await expect(outputs.getByRole("listitem").filter({ hasText: /agent-evidence\.md/i }))
    .toContainText(/agent-evidence\.md/i);

  await taskLanding;
  await page.reload({ waitUntil: "networkidle" });
  await expect(main.locator("ul.scope").getByText(/agent-evidence\.md/i)).toBeVisible();
  await expect(main.getByLabel("Task name")).toHaveValue("Verify imported transformer limit");
  await expect(main.locator("ul.scope").getByText(/agent-evidence\.md/i)).toBeVisible();
  await expect(main.getByText("Pending review", { exact: true })).toBeVisible();
  await expect(main.getByText("1 resource prepared", { exact: true })).toBeVisible();
  await expect(main.getByRole("list", { name: "Conversation" }).getByText(answer, {
    exact: true
  })).toBeVisible();
  const reloadedOutputs = main.getByRole("list", { name: "Outputs" });
  await expect(reloadedOutputs.getByRole("listitem").filter({ hasText: "Grounded answer" }))
    .toContainText("913 MVA");
  await expect(reloadedOutputs
    .getByRole("listitem").filter({ hasText: /agent-evidence\.md/i }))
    .toContainText(/agent-evidence\.md/i);

  await tabs(page).getByRole("button", { name: "External", exact: true }).click();
  await page.getByRole("table").getByRole("button", { name: "agent-evidence.md", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Inspector" }).getByRole("button", {
    name: "Delete",
    exact: true
  })).toBeDisabled();
});
