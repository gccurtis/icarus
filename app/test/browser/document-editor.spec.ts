import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

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

const pointOnText = async (target: Locator, text: string) => {
  await target.scrollIntoViewIfNeeded();
  const point = await target.evaluate((node, needle) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current !== null) {
      const value = current.textContent ?? "";
      const from = value.indexOf(needle);
      if (from !== -1) {
        const range = document.createRange();
        range.setStart(current, from);
        range.setEnd(current, from + needle.length);
        const rect = range.getClientRects()[0];
        if (rect !== undefined) {
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }
      current = walker.nextNode();
    }
    return undefined;
  }, text);
  if (point === undefined) throw new Error(`The text ${text} was not laid out.`);
  return point;
};

const dragAcrossText = async (
  page: Page,
  target: Locator,
  text: string,
  options: { control?: boolean; whilePressed?: () => Promise<void> } = {}
) => {
  await target.scrollIntoViewIfNeeded();
  const points = await target.evaluate((node, needle) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current !== null) {
      const value = current.textContent ?? "";
      const from = value.indexOf(needle);
      if (from !== -1) {
        const textNode = current;
        const edge = (offset: number) => {
          const range = document.createRange();
          range.setStart(textNode, offset);
          range.setEnd(textNode, offset + 1);
          return range.getClientRects()[0];
        };
        const first = edge(from);
        const last = edge(from + needle.length - 1);
        if (first !== undefined && last !== undefined) {
          return {
            start: { x: first.left + 1, y: first.top + first.height / 2 },
            end: { x: last.right - 1, y: last.top + last.height / 2 }
          };
        }
      }
      current = walker.nextNode();
    }
    return undefined;
  }, text);
  if (points === undefined) throw new Error(`The text ${text} was not laid out.`);

  if (options.control) await page.keyboard.down("Control");
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 10 });
  await options.whilePressed?.();
  await page.mouse.up();
  if (options.control) await page.keyboard.up("Control");
};

const openDocumentNamed = async (page: Page, title: string) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const toolbarTab = page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: title, exact: true });
  if ((await toolbarTab.count()) > 0) {
    await toolbarTab.click();
  } else {
    await page
      .getByRole("toolbar", { name: "Open tabs" })
      .getByRole("button", { name: "New tab" })
      .click();
    await page.getByRole("searchbox", { name: "Search this project" }).fill(title);
    await page.getByRole("button", { name: title }).first().click();
  }
  await expect(page.locator(".title-bar h1")).toHaveText(title);
  await expect(page.locator(".ProseMirror")).toBeVisible();
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

test("the reported incident and decision documents use sane non-overlapping leading", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  for (const title of [
    "Substation 14 incident write-up",
    "Transformer bank replacement decision"
  ]) {
    await openDocumentNamed(page, title);
    const paragraph = page.locator('.document-block[data-style="body"]').first();
    const typography = await paragraph.evaluate((node) => {
      const style = getComputedStyle(node);
      return { fontSize: Number.parseFloat(style.fontSize), lineHeight: Number.parseFloat(style.lineHeight) };
    });
    expect(typography.lineHeight, `${title} should not retain ratio-sized pixel leading`)
      .toBeGreaterThanOrEqual(typography.fontSize * 1.25);

    const boxes = await page.locator(".document-page .document-block").evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            text: node.textContent?.trim() ?? ""
          };
        })
        .filter((rect) => rect.text.length > 0)
        .sort((left, right) => left.top - right.top)
    );
    for (let index = 0; index < boxes.length; index += 1) {
      for (let other = index + 1; other < boxes.length; other += 1) {
        const horizontalOverlap =
          Math.min(boxes[index].right, boxes[other].right) -
          Math.max(boxes[index].left, boxes[other].left);
        if (horizontalOverlap <= 0) continue;
        expect(boxes[other].top, `${title}: ${boxes[other].text} overlaps ${boxes[index].text}`)
          .toBeGreaterThanOrEqual(boxes[index].bottom - 0.5);
      }
    }
  }
});

test("the review fixture exposes page numbers and every visible comment state", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const pages = page.locator(".document-page");
  await expect(pages).toHaveCount(2);
  await expect(pages.nth(0).locator(".document-page-number")).toHaveCount(0);
  await expect(pages.nth(1).locator(".document-page-number")).toHaveText("1");

  await expect(page.locator('.comment-anchor[data-thread="commentThreads:4"]')).toHaveCount(2);
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:5"]')).toHaveCount(0);
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:6"]')).toHaveCount(0);
  await expect(page.locator('.comment-anchor[data-thread="commentThreads:7"]')).toHaveCount(0);
  await expect(page.locator('button.pin[data-threads~="commentThreads:4"]')).not.toHaveCount(0);
  await expect(page.locator('button.pin[data-threads~="commentThreads:5"]')).toHaveCount(0);
  await expect(page.locator('button.pin[data-threads~="commentThreads:6"]')).toHaveCount(0);

  await page.locator('button.pin[data-threads~="commentThreads:4"]').first().click();
  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.comment"]'
  );
  await expect(inspector.getByRole("heading", { name: "Comment" })).toBeVisible();

  const selected = inspector.locator('section[aria-labelledby="comment-anchor"]');
  const conversation = inspector.locator('section[aria-labelledby="comment-conversation"]');
  await expect(selected).toContainText("The corridor itself is scheduled for reconductoring");
  await expect(selected).toContainText("The second concentration is behind the coastal tie");
  await expect(conversation.getByText("Original comment", { exact: true })).toBeVisible();
  await expect(conversation.getByText("Replies", { exact: true })).toBeVisible();
  const opening = conversation.getByText("Original comment", { exact: true });
  const composer = conversation.getByPlaceholder("Write a reply…");
  const replies = conversation.getByText("Replies", { exact: true });
  expect(
    await opening.evaluate((node, following) =>
      Boolean(node.compareDocumentPosition(following as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await composer.elementHandle()
    )
  ).toBe(true);
  expect(
    await composer.evaluate((node, following) =>
      Boolean(node.compareDocumentPosition(following as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await replies.elementHandle()
    )
  ).toBe(true);
  await expect(conversation.getByRole("button", { name: "Resolve", exact: true })).toBeVisible();
  await expect(conversation.getByRole("button", { name: "Reply", exact: true })).toBeDisabled();
  await expect(inspector.locator("header").getByRole("button", { name: /Reply|Resolve/ })).toHaveCount(0);
  expect(
    await selected.evaluate((node, following) =>
      Boolean(node.compareDocumentPosition(following as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await conversation.elementHandle()
    )
  ).toBe(true);

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(context.getByText("The text this was on is gone.", { exact: true })).toHaveCount(2);
  const resolved = context.getByRole("button", { name: /Resolved\s+1/ });
  await expect(resolved).toBeVisible();
  await resolved.click();
  await expect(
    context.getByText("The engineering scope link now carries the supporting note.", {
      exact: true
    })
  ).toBeVisible();
});

test("the comment lane remains attached to the centered page across zoom and resizing", async ({
  page
}) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const geometry = () =>
    page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>(".document-page");
      const lane = document.querySelector<HTMLElement>(".lane");
      const pin = document.querySelector<HTMLElement>(".lane button.pin");
      const anchor = document.querySelector<HTMLElement>(".comment-anchor");
      if (sheet === null || lane === null || pin === null || anchor === null) return undefined;

      const pageBox = sheet.getBoundingClientRect();
      const laneBox = lane.getBoundingClientRect();
      const pinBox = pin.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      return {
        laneGap: laneBox.left - pageBox.right,
        pinGap: pinBox.left - pageBox.right,
        anchorOffset: anchorBox.top - (pinBox.top + 4)
      };
    });

  const expectAttached = async () => {
    await expect.poll(geometry).toEqual({
      laneGap: 6,
      pinGap: 6,
      anchorOffset: 0
    });
  };

  await expectAttached();

  const current = await page
    .locator(".editor")
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).zoom) * 100);
  await page.locator(".canvas").evaluate((node, deltaY) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY })
    );
  }, (current - 50) * 60);

  await expectAttached();
  await page.setViewportSize(viewports.expanded);
  await expectAttached();
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

  const foreground = inspector.getByRole("button", { name: "Color" });
  await foreground.click();
  await page.getByRole("radiogroup", { name: "Color" }).getByRole("radio", { name: "Accent 2" }).click();
  await expect(page.locator(".held-selection")).toBeVisible();
  await foreground.click();
  await page.getByRole("radiogroup", { name: "Color" }).getByRole("radio", { name: "Danger" }).click();
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

test("Next letter keeps the comment and link context under the caret", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const link = page.locator('[data-block="#bbody3"]').getByRole("link", {
    name: "reconductoring",
    exact: true
  });
  await link.dblclick();
  await expect(
    page.locator('aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]')
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.next-letter"]'
  );
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole("button", { name: /Links\s+1/ })).toBeVisible();
  await expect(inspector.getByText("Engineering scope and seasonal construction assumptions.", {
    exact: true
  })).toBeVisible();
  await expect(inspector.getByRole("button", { name: /^Comments/ })).toContainText("0");

  const commentAnchor = page.locator('.comment-anchor[data-thread="commentThreads:4"]').first();
  await commentAnchor.scrollIntoViewIfNeeded();
  const commentPoint = await commentAnchor.evaluate((node) => {
    const rect = node.getClientRects()[0];
    return rect === undefined ? undefined : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  if (commentPoint === undefined) throw new Error("The comment anchor was not laid out.");
  await page.mouse.dblclick(commentPoint.x, commentPoint.y);
  await expect(
    page.locator('aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]')
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");

  await expect(inspector.getByRole("button", { name: /Comments\s+1/ })).toBeVisible();
  await expect(inspector.getByText("Open conversations under the caret", { exact: true })).toBeVisible();
});

test("Control-double-click adds a distinct range but comments require one contiguous selection", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const first = await pointOnText(page.locator('[data-block="#bbody1"]'), "Substation");
  await page.mouse.dblclick(first.x, first.y);
  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(inspector.locator("figure")).toContainText("Substation");

  const second = await pointOnText(page.locator('[data-block="#bbody2"]'), "Nothing");
  await page.keyboard.down("Control");
  await page.mouse.dblclick(second.x, second.y);
  await page.keyboard.up("Control");

  await expect(inspector.locator("figure").first()).toContainText("2 selections");
  await expect(inspector.locator("figure")).toContainText("Substation");
  await expect(inspector.locator("figure")).toContainText("Nothing");
  await expect(page.locator(".multi-range")).toHaveCount(1);

  const comments = inspector.getByRole("button", { name: /^Comments/ });
  await comments.click();
  await expect(
    inspector.getByText(
      "Comments require one contiguous selection. Keep one passage selected to start a thread.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(inspector.getByPlaceholder("Write a comment on the selection…")).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Add comment" })).toHaveCount(0);

  await page.mouse.dblclick(first.x, first.y);
  await expect(inspector.locator("figure").first()).not.toContainText("2 selections");
  await expect(inspector.locator("figure").first()).toContainText("Substation");
  await comments.click();
  await inspector.getByPlaceholder("Write a comment on the selection…").fill(
    "This passage needs review."
  );
  await inspector.getByRole("button", { name: "Add comment" }).click();

  await expect(comments).toContainText("1");
  await expect(inspector.getByTitle("Open the thread")).toHaveCount(1);
  await page.mouse.dblclick(first.x, first.y);
  await page.keyboard.press("ArrowRight");
  const caretInspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.next-letter"]'
  );
  await expect(caretInspector).toBeVisible();
  await page.keyboard.type("!");
  await expect(caretInspector).toBeVisible();
});

test("Control-drag adds a distinct text range", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  await dragAcrossText(page, page.locator('[data-block="#bbody1"]'), "Substation");
  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(inspector).toBeVisible();

  await dragAcrossText(page, page.locator('[data-block="#bbody2"]'), "Nothing", {
    control: true,
    whilePressed: async () => {
      await expect(inspector.locator("figure").first()).toContainText("2 selections", {
        timeout: 1_000
      });
    }
  });

  await expect(inspector.locator("figure").first()).toContainText("2 selections");
  await expect(page.locator(".multi-range")).toHaveCount(1);
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

  const emptyLine = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.empty-line"]'
  );
  await expect(emptyLine.getByRole("heading", { name: "Empty line" })).toBeVisible();
  await expect(emptyLine.getByText("Placement", { exact: true })).toHaveCount(0);

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

  const foreground = inspector.getByRole("button", { name: "Color" });
  const background = inspector.getByRole("button", { name: "Background" });
  await expect(foreground).toBeVisible();
  await expect(background).toBeVisible();
  const [fg, bg] = await Promise.all([foreground.boundingBox(), background.boundingBox()]);
  expect(Math.abs((fg?.y ?? 0) - (bg?.y ?? 0))).toBeLessThan(2);

  const alignment = inspector.getByRole("group", { name: "Alignment" });
  await expect(alignment).toBeVisible();
  const [alignmentBox, formattingBox] = await Promise.all([
    alignment.boundingBox(),
    inspector.getByRole("group", { name: "Formatting" }).boundingBox()
  ]);
  expect(Math.abs((alignmentBox?.width ?? 0) - (formattingBox?.width ?? 0))).toBeLessThan(2);
  await expect(inspector.getByText("Alignment", { exact: true })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Spacing", exact: true }).click();
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
  const rail = context.getByRole("navigation", { name: "Context views" });
  expect(await rail.evaluate((node) => getComputedStyle(node).borderInlineStartWidth)).toBe("0px");
  expect(
    await rail
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))
  ).toEqual([
    "Layout",
    "Find",
    "Styles",
    "Comments",
    "Variables",
    "Templates",
    "Prompts",
    "Sections"
  ]);

  await context.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Sections" })).toBeVisible();
  await expect(context.getByRole("button", { name: /H1 Winter readiness brief P1/ })).toBeVisible();
  await expect(context.getByRole("button", { name: /H2 Where the exposure sits P1/ })).toBeVisible();
  await expect(context.getByRole("button", { name: /H2 What it would cost P2/ })).toBeVisible();
  await expect(context.getByText(/L\d+/)).toHaveCount(0);
  await expect(context.locator('[title="Where the exposure sits"]')).toBeVisible();

  await context.getByRole("button", { name: "Find", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Find" })).toBeVisible();
  const find = context.getByPlaceholder("Find in the document…");
  await find.fill("Winter");
  await expect(context.getByText("Winter", { exact: true }).first()).toBeVisible();

  await context.getByRole("button", { name: "Styles", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Styles" })).toBeVisible();
  const styles = context.getByPlaceholder("Filter styles…");
  await styles.fill("Body");
  await expect(context.getByText("Body", { exact: true }).first()).toBeVisible();

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

test("document named styles mirror the text formatting inspector without metadata clutter", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Styles", exact: true }).click();
  await context.getByRole("button", { name: "Body", exact: true }).click();

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.named-style"]'
  );
  await expect(inspector).toBeVisible();
  const name = inspector.getByRole("button", { name: "Body", exact: true }).first();
  await name.click();
  await expect(inspector.getByRole("textbox", { name: "Style name" })).toBeVisible();
  await inspector.getByRole("textbox", { name: "Style name" }).press("Escape");

  for (const mark of ["Bold", "Italic", "Underline", "Strikethrough"] as const) {
    await expect(inspector.getByTitle(mark)).toBeVisible();
  }
  await expect(inspector.getByRole("button", { name: "Color for this style" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Background for this style" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Spacing", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Spacing", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(inspector.getByText("Body style", { exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("group", { name: "Alignment" })).toBeVisible();
  await expect(inspector.getByText("Alignment", { exact: true })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Spacing", exact: true }).click();
  await expect(inspector.getByRole("spinbutton", { name: "Line height" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Indent" })).toBeVisible();

  for (const obsolete of ["Identity", "Usage", "Key", "Reads as", "Weight"]) {
    await expect(inspector.getByText(obsolete, { exact: true })).toHaveCount(0);
  }
});

test("layout omits header and footer authoring while page numbers remain", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await openFixture(page);

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(context.getByText("Header and footer", { exact: true })).toHaveCount(0);
  await expect(context.getByRole("button", { name: /(?:Add|Remove) (?:header|footer)/i })).toHaveCount(0);
  await expect(page.locator('[data-furniture], .document-furniture')).toHaveCount(0);
  await expect(page.locator(".ProseMirror")).not.toContainText("Operations / Winter readiness");
  await expect(page.locator(".ProseMirror")).not.toContainText("Internal readiness review");
  await expect(page.locator(".document-page-number-band")).toHaveCount(1);
  await expect(page.locator(".document-page-number")).toHaveText("1");
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
    await expect(panel.getByRole("button", { name: "Color" })).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Background" })).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Color" })).toHaveText("");
    await expect(panel.getByRole("button", { name: "Background" })).toHaveText("");
    await expect(panel.getByRole("button", { name: /Increase|Decrease/ })).toHaveCount(0);
  }

  await expect(panels.nth(1).getByText("Color", { exact: true })).toBeVisible();
  await expect(panels.nth(1).getByText("Background", { exact: true })).toBeVisible();
  await expect(panels.nth(1).getByRole("button", { name: "Background" }).locator("svg")).toHaveCount(1);

  await expect(panels.nth(0).locator(".short-label").first()).toBeVisible();
  await expect(panels.nth(0).locator(".full-label").first()).toBeHidden();
  await expect(panels.nth(2).locator(".short-label").first()).toBeHidden();
  await expect(panels.nth(2).locator(".full-label").first()).toBeVisible();

  await panels.nth(1).getByRole("button", { name: "Color" }).click();
  await expect(page.getByRole("radiogroup", { name: "Color" }).getByRole("radio", { name: "None" })).toHaveCount(0);
  await page.getByRole("button", { name: "More colours…" }).click();
  await expect(page.getByRole("status").first()).toContainText("custom-colour detail screen");

  await panels.nth(1).getByRole("button", { name: "Background" }).click();
  const none = page
    .getByRole("radiogroup", { name: "Background" })
    .getByRole("radio", { name: "None" });
  await expect(none).toBeVisible();
  await expect(none.locator("svg")).toHaveCount(1);
});
