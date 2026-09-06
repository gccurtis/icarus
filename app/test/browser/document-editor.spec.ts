import { expect, test, type Page, type TestInfo } from "@playwright/test";

const viewports = {
  narrow: { width: 1120, height: 850 },
  default: { width: 1440, height: 900 },
  expanded: { width: 1720, height: 1000 }
} as const;

const unexpected: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      const location = message.location().url;
      unexpected.push(
        `console:${message.type()}: ${message.text()}${location ? ` @ ${location}` : ""}`
      );
    }
  });
  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      request.url().includes("/__data.json")
    ) {
      return;
    }
    unexpected.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      unexpected.push(`http:${response.status()}: ${response.request().method()} ${response.url()}`);
    }
  });
};

const openFixture = async (page: Page) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Winter readiness brief", exact: true }).dblclick();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toContainText("Winter readiness brief");
};

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

for (const [name, viewport] of Object.entries(viewports)) {
  test(`Winter readiness brief opens cleanly at the ${name} editor viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFixture(page);

    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(pageOverflow).toBe(false);
  });
}

test("the fixture can be reached with the keyboard", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  const fixture = page.getByRole("button", { name: "Winter readiness brief", exact: true });
  await fixture.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator(".ProseMirror")).toBeVisible();
});

test("a text selection opens the functional responsive inspector", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  await page
    .locator(".document-block")
    .filter({ hasText: "Winter readiness brief" })
    .first()
    .click({ position: { x: 35, y: 12 }, clickCount: 2 });

  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]');
  await expect(inspector).toBeVisible();
  await expect(inspector.getByTitle("Bold")).toHaveCount(1);
  await expect(inspector.getByTitle("Italic")).toHaveCount(1);
  await expect(inspector.getByTitle("Underline")).toHaveCount(1);
  await expect(inspector.getByTitle("Strikethrough")).toHaveCount(1);
  await expect(inspector.getByTitle("Code")).toHaveCount(0);

  const foreground = inspector.getByRole("button", { name: "Foreground" });
  const background = inspector.getByRole("button", { name: "Background" });
  await expect(foreground).toBeVisible();
  await expect(background).toBeVisible();
  const [fg, bg] = await Promise.all([foreground.boundingBox(), background.boundingBox()]);
  expect(Math.abs((fg?.y ?? 0) - (bg?.y ?? 0))).toBeLessThan(2);

  await inspector.getByRole("button", { name: /^Body style/ }).click();
  await expect(page.locator(".held-selection").first()).toBeVisible();
  await expect(inspector.getByText("Space above", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Space below", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: /Increase|Decrease/ })).toHaveCount(0);

  await inspector.getByRole("button", { name: /^Links/ }).click();
  await expect(inspector.getByRole("textbox", { name: "Link notes" })).toBeVisible();
});

test("document context panels are operational and compact", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Sections" })).toBeVisible();

  await context.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Layout" })).toBeVisible();

  const portrait = context.getByRole("radio", { name: "Portrait" });
  const landscape = context.getByRole("radio", { name: "Landscape" });
  await expect(portrait).toBeVisible();
  await expect(landscape).toBeVisible();
  const [portraitBox, landscapeBox] = await Promise.all([
    portrait.boundingBox(),
    landscape.boundingBox()
  ]);
  expect(Math.abs((portraitBox?.y ?? 0) - (landscapeBox?.y ?? 0))).toBeLessThan(2);

  await expect(context.getByText("Margins (in)", { exact: true })).toBeVisible();
  await expect(context.getByRole("spinbutton", { name: "Top margin in inches" })).toBeVisible();
  await expect(context.getByRole("spinbutton", { name: "Left margin in inches" })).toBeVisible();
  await expect(context.getByText(/from edge/i)).toHaveCount(0);
  await expect(context.getByRole("button", { name: /Increase|Decrease/ })).toHaveCount(0);

  for (const name of ["Variables", "Templates", "Prompts"] as const) {
    await context.getByRole("button", { name, exact: true }).click();
    await expect(context.getByText(`document-editor.${name.toLowerCase()}`, { exact: true })).toBeVisible();
  }
});

test("headers and footers edit on the page through the shared editor", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Layout", exact: true }).click();
  const showHeader = context.getByRole("switch", { name: "Show header" });
  if (!(await showHeader.isChecked())) await showHeader.click();

  const canonical = page.locator('[data-furniture="header"]');
  await expect(canonical).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  await context.getByRole("button", { name: "Edit header" }).click();
  await page.keyboard.type("Operations brief");
  await expect(canonical).toContainText("Operations brief");

  await canonical.locator(".document-block").first().dblclick({ position: { x: 35, y: 8 } });
  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(inspector).toBeVisible();
  const bold = inspector.getByTitle("Bold");
  if ((await bold.getAttribute("data-state")) !== "on") await bold.click();
  await expect(canonical.locator("strong").first()).toBeVisible();

  const pages = await page.locator(".document-page").count();
  await expect(page.locator(".document-furniture-projection.document-header")).toHaveCount(
    Math.max(0, pages - 1)
  );
  await expect(page.locator(".furniture-editor")).toHaveCount(0);
});

test("shared editor controls keep one behavior across the width matrix", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/demo/document-editor-controls", { waitUntil: "networkidle" });

  const panels = page.locator("main.controls-demo section");
  await expect(panels).toHaveCount(3);

  for (const panel of await panels.all()) {
    await expect(panel.getByTitle("Bold")).toHaveCount(1);
    await expect(panel.getByTitle("Italic")).toHaveCount(1);
    await expect(panel.getByTitle("Underline")).toHaveCount(1);
    await expect(panel.getByTitle("Strikethrough")).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Foreground" })).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Background" })).toHaveCount(1);
    await expect(panel.getByRole("button", { name: /Increase|Decrease/ })).toHaveCount(0);
  }

  await expect(panels.nth(0).locator(".short-label").first()).toBeVisible();
  await expect(panels.nth(0).locator(".full-label").first()).toBeHidden();
  await expect(panels.nth(2).locator(".short-label").first()).toBeHidden();
  await expect(panels.nth(2).locator(".full-label").first()).toBeVisible();

  await panels.nth(1).getByRole("button", { name: "Foreground" }).click();
  await page.getByRole("button", { name: "More colours…" }).click();
  await expect(page.getByRole("status").first()).toContainText("custom-colour detail screen");
});
