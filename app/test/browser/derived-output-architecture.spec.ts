import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("the procedure page renders all three diagrams and switches its callable spine", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/derived-output-flow", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("One text path in.");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);

  const generation = page.getByRole("tab", { name: /Prompt → response/ });
  await generation.click();
  await expect(generation).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".function-list")).toContainText("createPromptBlock");
  await expect(page.locator(".function-list")).toContainText("querySemanticOverlay");

  const reading = page.getByRole("tab", { name: /ID → rendered value/ });
  await reading.click();
  await expect(page.locator(".function-list")).toContainText("readDerivedOutputValue");
  await page.screenshot({ path: "/tmp/derived-output-flow.png", fullPage: true });
});

test("the agent page renders its loop and exposes every tool contract", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/agent-runtime", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("The agent gets");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);

  const find = page.getByRole("tab", { name: /find_resources/ });
  await find.click();
  await expect(find).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".tool-detail")).toContainText("Navigation does not mint factual evidence");

  const read = page.getByRole("tab", { name: /^03 read/ });
  await read.click();
  await expect(page.locator(".tool-detail")).toContainText("allowlisted and paginated");
  await page.screenshot({ path: "/tmp/derived-output-agent-runtime.png", fullPage: true });
});

test("both pages contain page-level overflow at narrow width only inside intentional diagrams", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/demo/semantic-overlay/derived-output-flow",
    "/demo/semantic-overlay/agent-runtime"
  ]) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator(".mermaid-output svg").first()).toBeVisible({ timeout: 20_000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      ),
      `${route} should keep wide diagrams inside their own scroll containers`
    ).toBe(true);
  }
});
