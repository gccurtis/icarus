import { expect, test, type Page, type TestInfo } from "@playwright/test";

const routes = [
  ["system", "/app/dev-project/reference/templates", "How templates work"],
  ["changes", "/app/dev-project/reference/templates/changes", "What changed"],
  ["scope", "/app/dev-project/reference/templates/scope", "What a hole selects"]
] as const;

const unexpected: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      unexpected.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) return;
    unexpected.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
  });
};

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("both template reference pages load and stay within the narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [, route, heading] of routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `${route} should not create page-level horizontal overflow`
    ).toBe(true);
  }
});

test("the ledger filters by area without changing what the summary measured", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/app/dev-project/reference/templates/changes", { waitUntil: "networkidle" });

  const total = await page.locator(".summary div").first().locator("dd").innerText();
  const rows = page.locator(".ledger tbody tr");
  await expect(rows).toHaveCount(Number(total));

  await page.getByRole("button", { name: /^Templates capability/ }).click();
  const shown = await rows.count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(Number(total));
  await expect(page.locator(".summary div").first().locator("dd")).toHaveText(total);

  await page.getByRole("button", { name: /^Everything \d+$/ }).click();
  await expect(rows).toHaveCount(Number(total));
});

test("the system page carries its diagrams and reaches the change set", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/app/dev-project/reference/templates", { waitUntil: "networkidle" });

  await expect(page.getByRole("img", { name: /A document becomes a template/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /pressing Save moves the template's revision once/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Two saves, two meanings" })).toBeVisible();

  await page.getByRole("link", { name: "What changed", exact: false }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "What changed" })).toBeVisible();
});

test("the reference pages read in either material, and the choice carries between them", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/app/dev-project/reference/templates/scope", { waitUntil: "networkidle" });

  const material = page.getByRole("group", { name: "Material" });
  await expect(material.getByRole("button", { name: "Helios" })).toHaveAttribute("aria-pressed", "true");

  await material.getByRole("button", { name: "Selene" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "selene");

  await page.goto("/app/dev-project/reference/templates", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "selene");
  await expect(
    page.getByRole("group", { name: "Material" }).getByRole("button", { name: "Selene" })
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("group", { name: "Material" }).getByRole("button", { name: "Helios" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "helios");
});

test("the scope page carries its mock, its file list and its settled decisions", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/app/dev-project/reference/templates/scope", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 2, name: "The builder" })).toBeVisible();
  await expect(page.getByText("Insert “Client status note”").first()).toBeVisible();
  await expect(page.getByText("From", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Two kinds of hole" })).toBeVisible();

  await expect(page.getByRole("heading", { level: 2, name: "Every file it touched" })).toBeVisible();
  await expect(page.locator("#work tbody tr").first()).toBeVisible();

  const recommended = page.locator("#forks .state.after");
  await expect(recommended).toHaveCount(8);

  await page.getByRole("link", { name: "How templates work", exact: false }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "How templates work" })).toBeVisible();
});
