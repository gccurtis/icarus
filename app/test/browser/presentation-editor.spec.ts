import { expect, test, type Page, type TestInfo } from "./fixtures";

const unexpected: string[] = [];
const PRESENTATION_TITLE = "Board review — Q1 exposure";

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

const openPresentation = async (page: Page) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const surface = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  const title = page.locator(".area-title");
  if (!(await surface.isVisible()) || !(await title.textContent())?.includes(PRESENTATION_TITLE)) {
    const tab = page
      .getByRole("toolbar", { name: "Open tabs" })
      .getByRole("button", { name: PRESENTATION_TITLE, exact: true });
    if ((await tab.count()) > 0) {
      await tab.click();
    } else {
      await page
        .getByRole("toolbar", { name: "Open tabs" })
        .getByRole("button", { name: "Overview", exact: true })
        .click();
      await page.getByRole("button", { name: PRESENTATION_TITLE, exact: true }).first().dblclick();
    }
  }

  await expect(surface).toBeVisible();
  await expect(title).toContainText(PRESENTATION_TITLE);
  const previous = page.getByRole("button", { name: "Previous", exact: true });
  while (await previous.isEnabled()) await previous.click();
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

test("the canonical presentation opens with its slide surface and controls", async ({ page }) => {
  const surface = await openPresentation(page);

  await expect(surface.locator("[data-item]")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await expect(page.getByTitle("Back to fit")).toHaveText(/^\d+%$/);
});

test("the slide inspector lists only background and hidden state", async ({ page }) => {
  const surface = await openPresentation(page);
  await surface.click({ position: { x: 8, y: 8 } });

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="presentation-editor.slide"]'
  );
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("Background", { exact: true })).toBeVisible();
  await expect(inspector.getByLabel("Slide background override")).toBeVisible();
  const hidden = inspector.getByRole("switch", { name: "Hide this slide" });
  await expect(inspector.getByText("Hidden", { exact: true })).toBeVisible();
  await expect(hidden).toBeVisible();

  await expect(inspector.getByRole("button", { name: "Slide", exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Reset to layout" })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Edit notes" })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Notes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("button", { name: "Notes", exact: true })).toBeVisible();

  const wasHidden = await hidden.isChecked();
  await hidden.click();
  await expect(hidden).toBeChecked({ checked: !wasHidden });
  await hidden.click();
  await expect(hidden).toBeChecked({ checked: wasHidden });
});

test("horizontal slide overflow uses the quiet themed canvas scrollbar", async ({ page }) => {
  await openPresentation(page);
  const canvas = page.locator(".area-canvas");
  await page.getByTitle("Back to fit").click();

  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  for (let step = 0; step < 20; step += 1) await zoomIn.click();
  await expect.poll(() => canvas.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);

  const quiet = await canvas.evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.scrollbarWidth, color: style.scrollbarColor };
  });
  expect(quiet.width).toBe("thin");
  expect(quiet.color).not.toBe("auto");

  await canvas.hover();
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).scrollbarColor))
    .not.toBe(quiet.color);

  await page.getByTitle("Back to fit").click();
});

test("Insert tiles immediately add centered objects with the unified text inspector", async ({ page }) => {
  const surface = await openPresentation(page);
  const context = page.locator('aside[aria-label="Context"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await context.getByRole("button", { name: "Insert", exact: true }).click();

  const before = await surface.locator("[data-item]").count();
  await context.getByRole("button", { name: "Rectangle", exact: true }).click();
  await expect(surface.locator("[data-item]")).toHaveCount(before + 1);
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.shape");

  const stageBox = await surface.boundingBox();
  const shapeBox = await surface.locator("[data-item]").last().boundingBox();
  expect(stageBox).not.toBeNull();
  expect(shapeBox).not.toBeNull();
  expect((shapeBox?.x ?? 0) + (shapeBox?.width ?? 0) / 2).toBeCloseTo(
    (stageBox?.x ?? 0) + (stageBox?.width ?? 0) / 2,
    0
  );
  expect((shapeBox?.y ?? 0) + (shapeBox?.height ?? 0) / 2).toBeCloseTo(
    (stageBox?.y ?? 0) + (stageBox?.height ?? 0) / 2,
    0
  );

  await expect(inspector.getByRole("button", { name: "Kind", exact: true }).last()).toHaveText("Rectangle");
  const wrapping = inspector.getByRole("group", { name: "Text wrap" });
  await expect(wrapping).toBeVisible();
  await expect(wrapping.getByRole("radio", { name: "Grow box" })).toHaveAttribute(
    "title",
    "Grow the box to fit its text"
  );
  await expect(wrapping.getByRole("radio", { name: "Shrink text" })).toHaveAttribute(
    "title",
    "Shrink the text to fit inside the box"
  );
  await expect(wrapping.getByRole("radio", { name: "Clip text" })).toHaveAttribute(
    "title",
    "Hide text that extends beyond the box"
  );
  const alignment = inspector.getByRole("group", { name: "Alignment", exact: true });
  const vertical = inspector.getByRole("group", { name: "Vertical alignment" });
  await expect(alignment).toBeVisible();
  await expect(vertical).toBeVisible();
  for (const option of ["Top", "Middle", "Bottom"] as const) {
    const button = vertical.getByRole("radio", { name: option });
    await expect(button).toHaveAttribute("title", option);
    await expect(button.locator("svg")).toHaveCount(1);
    await expect(button).toHaveText("");
  }
  const [alignmentBox, verticalBox, wrappingBox] = await Promise.all([
    alignment.boundingBox(),
    vertical.boundingBox(),
    wrapping.boundingBox()
  ]);
  expect(Math.abs((alignmentBox?.width ?? 0) - (verticalBox?.width ?? 0))).toBeLessThan(2);
  expect(alignmentBox?.width ?? 0).toBeGreaterThan((wrappingBox?.width ?? 0) + 20);
  await expect(inspector.getByText("Alignment", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText("Vertical alignment", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText("Text wrap", { exact: true })).toBeVisible();
  for (const field of ["Width", "Height", "X", "Y"] as const) {
    await expect(inspector.getByRole("spinbutton", { name: field, exact: true })).toBeVisible();
  }
  const [xBox, yBox] = await Promise.all([
    inspector.getByRole("spinbutton", { name: "X", exact: true }).boundingBox(),
    inspector.getByRole("spinbutton", { name: "Y", exact: true }).boundingBox()
  ]);
  expect(Math.abs((xBox?.y ?? 0) - (yBox?.y ?? 0))).toBeLessThan(2);
  await expect(inspector.getByRole("spinbutton", { name: /^Rotation/ })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Color", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Background", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Border", exact: true }).first()).toBeVisible();
  await expect(inspector.getByText("Fill", { exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Spacing", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(inspector.getByRole("button", { name: "Effects", exact: true })).toHaveAttribute("aria-expanded", "false");

  const orderY = (await inspector.getByRole("button", { name: /^Order\b/ }).boundingBox())?.y ?? 0;
  const spacingY = (await inspector.getByRole("button", { name: "Spacing", exact: true }).boundingBox())?.y ?? 0;
  const effectsY = (await inspector.getByRole("button", { name: "Effects", exact: true }).boundingBox())?.y ?? 0;
  expect(orderY).toBeLessThan(spacingY);
  expect(spacingY).toBeLessThan(effectsY);

  await context.getByRole("button", { name: "Text box", exact: true }).click();
  await expect(surface.locator("[data-item]")).toHaveCount(before + 2);
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.text-box");
  await expect(inspector.getByRole("heading", { name: "Text box" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Kind", exact: true }).last()).toBeDisabled();
  await expect(inspector.getByRole("group", { name: "Text wrap" })).toBeVisible();
  await expect(context.getByText(/click where it goes|click on the slide/i)).toHaveCount(0);
});

test("shift-click adds objects and control-click removes one without losing selection ids", async ({ page }) => {
  const surface = await openPresentation(page);
  const first = surface.locator('[data-item="el-1"]');
  const second = surface.locator('[data-item="el-2"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');

  await first.click({ position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.text-box");
  await expect(surface.locator(".outline:not(.is-hover)")).toHaveCount(1);

  await second.click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.multi-selection");
  await expect(inspector.getByRole("heading", { name: "2 objects" })).toBeVisible();
  await expect(surface.locator(".outline:not(.is-hover)")).toHaveCount(2);

  await first.click({ modifiers: ["Control"], position: { x: 8, y: 8 } });
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.text-box");
  await expect(surface.locator(".outline:not(.is-hover)")).toHaveCount(1);
});

test("an anchored slide comment survives the presentation-owned comment-lens round trip", async ({ page }) => {
  let surface = await openPresentation(page);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  surface = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  const badge = surface.locator('[data-badge="el-5"]');
  await expect(badge).toHaveAttribute("aria-label", "1 comment");
  await badge.click();

  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.threads");
  await expect(inspector).toContainText("Slide 6 still says Q4. Worth a pass before Thursday.");

  await inspector
    .getByRole("button", { name: "Slide 6 still says Q4. Worth a pass before Thursday." })
    .click();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.comment");
  await expect(inspector.getByRole("heading", { name: "Comment" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Show in presentation" })).toBeVisible();
  await expect(inspector).toContainText("Feeder A");
  expect(unexpected, "opening the presentation-owned comment lens should be quiet").toEqual([]);

  await inspector.getByRole("button", { name: "Show in presentation" }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.threads");
  await expect(surface.locator('[data-item="el-5"]')).toBeVisible();
});

test("Arrange keeps axis controls on rows and repeated distribution is stable", async ({ page }) => {
  const surface = await openPresentation(page);
  const items = surface.locator('[data-item="el-1"], [data-item="el-2"], [data-item="el-3"]');
  await surface.locator('[data-item="el-1"]').click({ position: { x: 8, y: 8 } });
  await surface.locator('[data-item="el-2"]').click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });
  await surface.locator('[data-item="el-3"]').click({ modifiers: ["Shift"], position: { x: 8, y: 8 } });

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="presentation-editor.multi-selection"]'
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
  await openPresentation(page);
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

test("presentation named styles use a dedicated complete inspector and render their marks", async ({ page }) => {
  const surface = await openPresentation(page);
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Style", exact: true }).click();
  await context.getByRole("button", { name: /^Title\b/ }).click();

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="presentation-editor.named-style"]'
  );
  await expect(inspector).toBeVisible();
  const styleName = inspector.getByRole("button", { name: "Title", exact: true }).first();
  await styleName.click();
  const nameInput = inspector.getByRole("textbox", { name: "Style name" });
  await nameInput.fill("Presentation headline");
  await nameInput.press("Enter");
  await expect(inspector.getByRole("button", { name: "Presentation headline", exact: true })).toBeVisible();

  for (const mark of ["Bold", "Italic", "Underline", "Strikethrough"] as const) {
    await expect(inspector.getByTitle(mark)).toBeVisible();
  }
  await expect(inspector.getByRole("button", { name: "Color for this style" })).toBeVisible();
  const background = inspector.getByRole("button", { name: "Background for this style" });
  await expect(background).toBeVisible();
  const vertical = inspector.getByRole("group", { name: "Vertical alignment" });
  await expect(vertical).toBeVisible();
  await expect(vertical.locator("svg")).toHaveCount(3);
  await expect(inspector.getByRole("button", { name: "Text style", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Spacing", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(inspector.getByText("Body style", { exact: true })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Spacing", exact: true }).click();
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
  const surface = await openPresentation(page);
  await surface.locator('[data-item="el-3"]').click({ position: { x: 8, y: 8 } });
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.shape");
  await expect(inspector.getByRole("heading", { name: "Rectangle" })).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: "Notes", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.speaker-notes");
  for (const mark of ["Bold", "Italic", "Underline", "Strikethrough"] as const) {
    await expect(inspector.getByTitle(mark)).toBeVisible();
  }
  await expect(inspector.getByRole("group", { name: "Vertical alignment" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Spacing", exact: true })).toHaveAttribute("aria-expanded", "false");
  await inspector.getByRole("button", { name: "Spacing", exact: true }).click();
  await expect(inspector.getByRole("spinbutton", { name: "Indent" })).toBeVisible();
});

test("a text box becomes an editable slide Prompt Block without changing its element shell", async ({ page }) => {
  const surface = await openPresentation(page);
  const context = page.locator('aside[aria-label="Context"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');

  await context.getByRole("button", { name: "Insert", exact: true }).click();
  await context.getByRole("button", { name: "Text box", exact: true }).click();
  const item = surface.locator("[data-item]").last();
  await expect(item).toContainText("Text");
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.text-box");
  await expect(inspector.getByRole("button", { name: "Prompt", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Comment", exact: true })).toBeVisible();

  await inspector.getByRole("button", { name: "Prompt", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.prompt-block");
  await expect(inspector.getByLabel("Prompt", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Generate", exact: true })).toBeDisabled();
  await expect(inspector.getByRole("button", { name: "Text style", exact: true })).toBeVisible();

  const star = surface.locator("[data-prompt]").last();
  await expect(star).toHaveAttribute("aria-label", "Edit Prompt Block");
  await expect(item).toContainText("Text");

  await item.dblclick({ position: { x: 24, y: 18 } });
  await expect(inspector).toHaveAttribute(
    "data-inspected",
    /presentation-editor\.(next-letter|text-selection)/
  );
  await page.keyboard.press("End");
  await page.keyboard.type(" retained");
  await expect(item).toContainText("Text retained");

  await star.click();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.prompt-block");

  await context.getByRole("button", { name: "Prompts", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Prompts", exact: true })).toBeVisible();
  await expect(context).toContainText("Text retained");
});

test("a slide Prompt Block is grounded by one exact uploaded External file", async ({ page }) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "External Files", exact: true }).click();
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name: "slide-grounding.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Transfer note\n\nThe remaining transfer capability is 842 MW for the slide scenario.\n"
    )
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  const surface = await openPresentation(page);
  const context = page.locator('aside[aria-label="Context"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await context.getByRole("button", { name: "Insert", exact: true }).click();
  await context.getByRole("button", { name: "Text box", exact: true }).click();
  const item = surface.locator("[data-item]").last();
  await inspector.getByRole("button", { name: "Prompt", exact: true }).click();
  await inspector
    .getByLabel("Prompt", { exact: true })
    .fill("State the transfer capability in the selected source.");

  await inspector.locator('button[title="Choose what this prompt reads"]').click();
  const scope = page.getByRole("dialog", { name: "What this prompt reads" });
  await scope.getByRole("button", { name: "Clear", exact: true }).click();
  await scope.getByRole("button", { name: "Resources", exact: true }).click();
  const external = scope.locator(".offer").filter({ hasText: "slide-grounding.md" });
  await expect(external).toBeVisible();
  await external.getByRole("button", { name: "Add", exact: true }).click();
  await scope.getByRole("button", { name: "Set the scope", exact: true }).click();
  await expect(
    inspector.locator('button[title="Choose what this prompt reads"]')
  ).toHaveText(/slide-grounding\.md/i);

  await inspector.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(item).toContainText("remaining transfer capability is 842 MW", {
    timeout: 150_000
  });
  await expect(item).not.toContainText("Protection isolated the transformer bank");
  await expect(inspector.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled({
    timeout: 150_000
  });

  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await openPresentation(page);
  await expect(reloaded.locator("[data-item]").last()).toContainText(
    "remaining transfer capability is 842 MW"
  );
});

test("a slide Prompt Block generates grounded editable text from another resource", async ({ page }) => {
  test.skip(
    process.env.ICARUS_LIVE_DERIVED_OUTPUT !== "1",
    "Set ICARUS_LIVE_DERIVED_OUTPUT=1 to spend real embedding and intelligence calls"
  );
  test.setTimeout(420_000);

  // Author the evidence through the ordinary document persistence path.
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page
    .locator(".area-editors")
    .getByRole("button", { name: "Document", exact: true })
    .click();
  await expect(page.locator(".title-bar h1")).toHaveText(/^Untitled document \d+$/);
  const sourceTitle = (await page.locator(".title-bar h1").textContent()) ?? "";
  const source = page.locator(".ProseMirror");
  await source.click();
  await page.keyboard.type("The Meridian observatory's test aperture is 27 millimeters.");
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });

  // Convert an ordinary slide text box, then use the production Derived Output path.
  const surface = await openPresentation(page);
  const context = page.locator('aside[aria-label="Context"]');
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await context.getByRole("button", { name: "Insert", exact: true }).click();
  await context.getByRole("button", { name: "Text box", exact: true }).click();
  const item = surface.locator("[data-item]").last();
  await inspector.getByRole("button", { name: "Prompt", exact: true }).click();
  await inspector
    .getByLabel("Prompt", { exact: true })
    .fill("What is the Meridian observatory's test aperture in millimeters?");
  await inspector.getByRole("button", { name: "Generate", exact: true }).click();

  await expect(item).toContainText("27", { timeout: 300_000 });
  await expect(surface.locator("[data-prompt]").last()).toBeVisible();
  await expect(inspector).toHaveAttribute("data-inspected", "presentation-editor.prompt-block");
  await expect(inspector.getByRole("button", { name: sourceTitle, exact: true })).toBeVisible();
  await expect(inspector).toContainText("test aperture is 27 millimeters");

  // Refresh remains an available pull signal even when the current value is fresh.
  const refresh = inspector.getByRole("button", { name: "Refresh", exact: true });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect(item).toContainText("27", { timeout: 300_000 });
  await expect(refresh).toBeEnabled({ timeout: 300_000 });
});
