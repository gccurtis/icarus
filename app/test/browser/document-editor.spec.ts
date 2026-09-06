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
  const editor = page.locator(".ProseMirror");
  if (!(await editor.isVisible())) {
    const tab = page
      .getByRole("toolbar", { name: "Open tabs" })
      .getByRole("button", { name: "Winter readiness brief", exact: true });
    if ((await tab.count()) > 0) {
      await tab.click();
    } else {
      await page
        .getByRole("button", { name: "Winter readiness brief", exact: true })
        .first()
        .dblclick();
    }
  }
  await expect(editor).toBeVisible();
  await expect(editor).toContainText("Winter readiness brief");
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

test("the review fixture exposes page furniture and every comment state", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const pages = page.locator(".document-page");
  await expect(pages).toHaveCount(2);
  await expect(pages.nth(0).locator(".document-page-number")).toHaveCount(0);
  await expect(pages.nth(1).locator(".document-page-number")).toHaveText("1");

  await expect(page.locator('.comment-anchor[data-thread="commentThreads:4"]')).toHaveCount(2);
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:5"]')).toHaveCount(1);
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:6"]')).toHaveCount(0);
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:7"]')).toHaveCount(0);
  await expect(page.locator('button.pin[data-threads~="commentThreads:4"]')).not.toHaveCount(0);
  await expect(page.locator('button.pin[data-threads~="commentThreads:5"]')).toHaveCount(1);
  await expect(page.locator('button.pin[data-threads~="commentThreads:6"]')).toHaveCount(0);

  await page.locator('button.pin[data-threads~="commentThreads:4"]').first().click();
  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="general.comment"]');
  await expect(inspector.getByRole("heading", { name: "Comment" })).toBeVisible();

  const selected = inspector.locator('section[aria-labelledby="comment-anchor"]');
  const conversation = inspector.locator('section[aria-labelledby="comment-conversation"]');
  await expect(selected).toContainText("The corridor itself is scheduled for reconductoring");
  await expect(selected).toContainText("The second concentration is behind the coastal tie");
  await expect(conversation.getByText("Original comment", { exact: true })).toBeVisible();
  await expect(conversation.getByText("Replies", { exact: true })).toBeVisible();
  expect(
    await selected.evaluate((node, following) =>
      Boolean(node.compareDocumentPosition(following as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await conversation.elementHandle()
    )
  ).toBe(true);

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(context.getByText("The text this was on is gone.", { exact: true })).toBeVisible();
  const resolved = context.getByRole("button", { name: /Resolved\s+1/ });
  await expect(resolved).toBeVisible();
  await resolved.click();
  await expect(
    context.getByText("The engineering scope link now carries the supporting note.", {
      exact: true
    })
  ).toBeVisible();
});

test("links use ordinary marks, keep notes, and obey document pointer gestures", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await page.context().route("https://example.com/**", async (route) => {
    await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Linked scope</title>" });
  });
  await openFixture(page);
  expect(unexpected, "diagnostics while opening the link fixture").toEqual([]);

  const block = page.locator('[data-block="#bbody3"]');
  const link = block.getByRole("link", { name: "reconductoring", exact: true });
  await expect(link).toHaveAttribute("href", "https://example.com/grid/reconductoring");
  await expect(block.locator("u")).toContainText("reconductoring");

  const popupPromise = page.waitForEvent("popup");
  await link.click({ modifiers: ["Control"] });
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://example.com/grid/reconductoring");
  await popup.close();
  await expect(block).not.toHaveClass(/ProseMirror-selectednode/);
  await expect(page.locator(".held-selection")).toHaveCount(0);
  expect(unexpected, "diagnostics while opening the link").toEqual([]);

  await link.dblclick();
  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(inspector.locator("figure")).toContainText("reconductoring");
  await expect(inspector.locator("figure")).not.toContainText("Bringing the");
  expect(unexpected, "diagnostics while selecting link text").toEqual([]);
  const note = inspector.getByText("Engineering scope and seasonal construction assumptions.", {
    exact: true
  });
  if (!(await note.isVisible())) {
    await inspector.getByRole("button", { name: /Links\s+1/ }).click();
  }
  await expect(note).toBeVisible();

  const underline = inspector.getByTitle("Underline");
  await expect(underline).toHaveAttribute("data-state", "on");
  await underline.click();
  await expect(block.locator("u")).toHaveCount(0);
  await expect(page.locator(".held-selection")).toBeVisible();
  await underline.click();
  await expect(block.locator("u")).toContainText("reconductoring");

  const foreground = inspector.getByRole("button", { name: "Foreground" });
  await foreground.click();
  await page.getByRole("radiogroup", { name: "Foreground" }).getByRole("radio", { name: "Accent 2" }).click();
  await expect(page.locator(".held-selection")).toBeVisible();
  await foreground.click();
  await page.getByRole("radiogroup", { name: "Foreground" }).getByRole("radio", { name: "Danger" }).click();
  await foreground.click();
  await expect(page.getByRole("button", { name: "Pick from screen" })).toBeVisible();
  await page.getByRole("button", { name: "More colours…" }).click();
  const custom = inspector.getByPlaceholder("#RRGGBB");
  await custom.fill("#1D4ED8");
  await inspector.getByRole("button", { name: "Apply" }).click();

  await inspector.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(inspector.getByRole("textbox", { name: "Edit link notes" })).toHaveValue(
    "Engineering scope and seasonal construction assumptions."
  );

  await block.dblclick({ modifiers: ["Shift"], position: { x: 80, y: 8 } });
  await expect(inspector.locator("figure")).toContainText("Bringing the reconductoring forward");
  await expect(inspector.locator("figure")).toContainText("rather than headroom.");
});

test("quote Enter creates a normal body paragraph without ornamental quote chrome", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const quote = page.locator('[data-block="#bquote"]');
  await expect(quote).toHaveAttribute("data-style", "quote");
  expect(await quote.evaluate((node) => getComputedStyle(node).borderInlineStartWidth)).toBe("0px");

  const box = await quote.boundingBox();
  if (box === null) throw new Error("The quote was not laid out.");
  await quote.click({ position: { x: Math.max(1, box.width - 4), y: Math.max(1, box.height - 4) } });
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body after quote");

  const next = page.locator(".document-block").filter({ hasText: "Body after quote" }).last();
  await expect(next).toHaveJSProperty("tagName", "P");
  await expect(next).toHaveAttribute("data-style", "");
  expect(
    await next.evaluate((node) => ({
      fontStyle: getComputedStyle(node).fontStyle,
      indent: getComputedStyle(node).textIndent
    }))
  ).toEqual({ fontStyle: "normal", indent: "0px" });
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector.getByRole("button", { name: "Style", exact: true })).toContainText("Body");
});

test("a header comment remains anchored while text is inserted before it", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const anchor = page.locator('.comment-anchor[data-thread="commentThreads:5"]');
  await expect(anchor).toHaveText("Winter readiness");

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Layout", exact: true }).click();
  await context.getByRole("button", { name: "Edit header" }).click();
  await page.keyboard.type("FY26 · ");
  await expect(anchor).toHaveText("Winter readiness");
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:5"]')).toHaveText(
    "Winter readiness"
  );
});

test("the fixture can be reached with the keyboard", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  const fixture = page.getByRole("button", { name: "Winter readiness brief", exact: true }).first();
  await fixture.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator(".ProseMirror")).toBeVisible();
});

test("appearance, focus, reduced motion, and grayscale preserve the editor hierarchy", async ({
  page
}) => {
  await page.setViewportSize(viewports.default);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page);

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-appearance", "helios");

  const appearance = page.getByRole("button", { name: "Switch to Celestial Selene" });
  await page.keyboard.press("Tab");
  await expect(appearance).toBeFocused();
  expect(
    await appearance.evaluate((element) => {
      const style = getComputedStyle(element);
      return Number.parseFloat(style.outlineWidth);
    })
  ).toBeGreaterThanOrEqual(2);

  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-appearance", "selene");
  await expect(page.getByRole("button", { name: "Switch to Celestial Helios" })).toBeVisible();
  expect(await root.evaluate((element) => getComputedStyle(element).colorScheme)).toContain("dark");

  const durations = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.animationDuration = "2s";
    probe.style.transitionDuration = "2s";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const seconds = (duration: string) =>
      duration.endsWith("ms") ? Number.parseFloat(duration) / 1000 : Number.parseFloat(duration);
    const result = {
      animation: seconds(style.animationDuration),
      transition: seconds(style.transitionDuration)
    };
    probe.remove();
    return result;
  });
  expect(durations.animation).toBeLessThanOrEqual(0.00001);
  expect(durations.transition).toBeLessThanOrEqual(0.00001);

  const frame = page.locator(".app");
  await frame.evaluate((element) => element.style.setProperty("filter", "grayscale(1)"));
  await expect(page.locator(".document-page").first()).toBeVisible();
  expect(await frame.getAttribute("style")).toContain("grayscale(1)");

  const hierarchy = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>("main.zone.work");
    const page = document.querySelector<HTMLElement>(".document-page");
    if (canvas === null || page === null) return undefined;
    return {
      canvas: getComputedStyle(canvas).backgroundColor,
      page: getComputedStyle(page).backgroundColor,
      rule: getComputedStyle(page).borderTopStyle
    };
  });
  expect(hierarchy).toBeDefined();
  expect(hierarchy?.canvas).not.toBe(hierarchy?.page);
  expect(hierarchy?.rule).not.toBe("none");
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
