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
  const title = page.locator(".area-title");
  if (!(await surface.isVisible()) || !(await title.textContent())?.includes(DECK_TITLE)) {
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
  await expect(title).toContainText(DECK_TITLE);
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
  await expect(surface.locator(".outline:not(.is-hover)")).toHaveCount(1);

  await second.click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.multi-selection");
  await expect(inspector.getByRole("heading", { name: "2 objects" })).toBeVisible();
  await expect(surface.locator(".outline:not(.is-hover)")).toHaveCount(2);

  await first.click({ modifiers: ["Control"], position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.text-box");
  await expect(surface.locator(".outline:not(.is-hover)")).toHaveCount(1);
});

test("an anchored slide comment survives the deck-owned comment-lens round trip", async ({ page }) => {
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
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.comment");
  await expect(inspector.getByRole("heading", { name: "Comment" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Show in deck" })).toBeVisible();
  await expect(inspector).toContainText("Feeder A");
  expect(unexpected, "opening the deck-owned comment lens should be quiet").toEqual([]);

  await inspector.getByRole("button", { name: "Show in deck" }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.threads");
  await expect(surface.locator('[data-item="el-5"]')).toBeVisible();
});

test("Arrange keeps axis controls on rows and repeated distribution is stable", async ({ page }) => {
  const surface = await openDeck(page);
  const items = surface.locator('[data-item="el-1"], [data-item="el-2"], [data-item="el-3"]');
  await surface.locator('[data-item="el-1"]').click({ position: { x: 8, y: 8 } });
  await surface.locator('[data-item="el-2"]').click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });
  await surface.locator('[data-item="el-3"]').click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="slide-deck-editor.multi-selection"]'
  );
  await expect(inspector).toBeVisible();

  for (const labels of [["Left", "Center", "Right"], ["Top", "Middle", "Bottom"]]) {
    const boxes = await Promise.all(
      labels.map((label) => inspector.getByRole("button", { name: label, exact: true }).boundingBox())
    );
    expect(Math.max(...boxes.map((box) => box?.y ?? 0)) - Math.min(...boxes.map((box) => box?.y ?? 0))).toBeLessThan(2);
  }

  const relative = inspector.getByRole("group", { name: "Align relative to" });
  await expect(relative.getByRole("radio", { name: "Selection" }).locator(".choice-full"))
    .toHaveText("Selection");
  await expect(relative.getByRole("radio", { name: "Slide" }).locator(".choice-full"))
    .toHaveText("Slide");
  await expect(inspector.getByRole("button", { name: "Match size", exact: true })).toBeVisible();

  const frames = () => items.evaluateAll((nodes) =>
    nodes.map((node) => ({ id: (node as HTMLElement).dataset.item, style: node.getAttribute("style") }))
  );
  const before = JSON.stringify(await frames());
  await inspector.getByRole("button", { name: "Vertical", exact: true }).click();
  await expect.poll(async () => JSON.stringify(await frames())).not.toBe(before);
  const once = JSON.stringify(await frames());
  await inspector.getByRole("button", { name: "Vertical", exact: true }).click();
  await expect.poll(async () => JSON.stringify(await frames())).toBe(once);
});

test("Find keeps every responsive choice distinguishable", async ({ page }) => {
  await openDeck(page);
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Find", exact: true }).click();

  const mode = context.getByRole("group", { name: "Mode" });
  await expect(mode.getByRole("radio", { name: "Find", exact: true }).locator(".choice-full"))
    .toHaveText("Find");
  await expect(mode.getByRole("radio", { name: "Replace", exact: true }).locator(".choice-full"))
    .toHaveText("Replace");

  const scope = context.getByRole("group", { name: "Scope" });
  await expect(scope.getByRole("radio", { name: "All", exact: true }).locator(".choice-full"))
    .toHaveText("All");
  await expect(scope.getByRole("radio", { name: "Slides", exact: true }).locator(".choice-full"))
    .toHaveText("Slides");
  await expect(scope.getByRole("radio", { name: "Notes", exact: true }).locator(".choice-full"))
    .toHaveText("Notes");
});

test("deck named styles use a dedicated complete inspector and render their marks", async ({ page }) => {
  const surface = await openDeck(page);
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Style", exact: true }).click();
  await context.getByRole("button", { name: /^Title\b/ }).click();

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="slide-deck-editor.named-style"]'
  );
  await expect(inspector).toBeVisible();
  const styleName = inspector.getByRole("button", { name: "Title", exact: true }).first();
  await styleName.click();
  const nameInput = inspector.getByRole("textbox", { name: "Style name" });
  await nameInput.fill("Deck headline");
  await nameInput.press("Enter");
  await expect(inspector.getByRole("button", { name: "Deck headline", exact: true })).toBeVisible();

  for (const mark of ["Bold", "Italic", "Underline", "Strikethrough"] as const) {
    await expect(inspector.getByTitle(mark)).toBeVisible();
  }
  await expect(inspector.getByRole("button", { name: "Foreground for this style" })).toBeVisible();
  const background = inspector.getByRole("button", { name: "Background for this style" });
  await expect(background).toBeVisible();
  await expect(inspector.getByRole("group", { name: "Vertical alignment" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Indent" })).toBeVisible();

  const strike = inspector.getByTitle("Strikethrough");
  await strike.click();
  await background.click();
  await page
    .getByRole("radiogroup", { name: "Background for this style" })
    .getByRole("radio", { name: "Attention" })
    .click();

  const title = surface.locator('[data-item="el-1"] [data-block="el-1-b"]');
  await expect.poll(() => title.evaluate((node) => getComputedStyle(node).textDecorationLine))
    .toContain("line-through");
  await expect.poll(() => title.evaluate((node) => getComputedStyle(node).backgroundColor))
    .not.toBe("rgba(0, 0, 0, 0)");
});

test("shape identity and speaker notes follow the same inspector grammar", async ({ page }) => {
  const surface = await openDeck(page);
  await surface.locator('[data-item="el-3"]').click({ position: { x: 8, y: 8 } });
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.shape");
  await expect(inspector.getByRole("heading", { name: "Rectangle" })).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: "Notes", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "slide-deck-editor.speaker-notes");
  for (const mark of ["Bold", "Italic", "Underline", "Strikethrough"] as const) {
    await expect(inspector.getByTitle(mark)).toBeVisible();
  }
  await expect(inspector.getByRole("group", { name: "Vertical alignment" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Indent" })).toBeVisible();
});
