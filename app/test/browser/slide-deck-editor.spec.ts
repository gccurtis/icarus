import { expect, test, type Page, type TestInfo } from "@playwright/test";

const unexpected: string[] = [];
const DECK_TITLE = "Board review — Q1 exposure";

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

const openDeck = async (page: Page) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const surface = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  if (!(await surface.isVisible())) {
    const tab = page
      .getByRole("toolbar", { name: "Open tabs" })
      .getByRole("button", { name: DECK_TITLE, exact: true });
    if ((await tab.count()) > 0) {
      await tab.click();
    } else {
      await page
        .getByRole("toolbar", { name: "Open tabs" })
        .getByRole("button", { name: "Overview", exact: true })
        .click();
      await page.getByRole("button", { name: DECK_TITLE, exact: true }).first().dblclick();
    }
  }

  await expect(surface).toBeVisible();
  await expect(page.locator(".area-title")).toContainText(DECK_TITLE);
  await expect(surface.locator('[data-item="el-1"]')).toBeVisible();
  return surface;
};

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("the canonical deck opens with its slide surface and controls", async ({ page }) => {
  const surface = await openDeck(page);

  await expect(surface.locator("[data-item]")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await expect(page.getByTitle("Back to fit")).toHaveText(/^\d+%$/);
});

test("shift-click adds objects and control-click removes one without losing selection ids", async ({ page }) => {
  const surface = await openDeck(page);
  const first = surface.locator('[data-item="el-1"]');
  const second = surface.locator('[data-item="el-2"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');

  await first.click({ position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.text-box");
  await expect(surface.locator(".outline")).toHaveCount(1);

  await second.click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.multi-selection");
  await expect(inspector.getByRole("heading", { name: "2 objects" })).toBeVisible();
  await expect(surface.locator(".outline")).toHaveCount(2);

  await first.click({ modifiers: ["Control"], position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.text-box");
  await expect(surface.locator(".outline")).toHaveCount(1);
});

test("an anchored slide comment survives the shared comment-lens round trip", async ({ page }) => {
  let surface = await openDeck(page);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  surface = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  const badge = surface.locator('[data-badge="el-5"]');
  await expect(badge).toHaveAttribute("aria-label", "1 comment");
  await badge.click();

  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.threads");
  await expect(inspector).toContainText("Slide 6 still says Q4. Worth a pass before Thursday.");

  await inspector
    .getByRole("button", { name: "Slide 6 still says Q4. Worth a pass before Thursday." })
    .click();
  await expect(inspector).toHaveAttribute("data-inspected", "general.comment");
  await expect(inspector.getByRole("heading", { name: "Comment" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Show in deck" })).toBeVisible();
  await expect(inspector).toContainText("Feeder A");
  expect(unexpected, "opening the shared comment lens should be quiet").toEqual([]);

  await inspector.getByRole("button", { name: "Show in deck" }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.threads");
  await expect(surface.locator('[data-item="el-5"]')).toBeVisible();
});
