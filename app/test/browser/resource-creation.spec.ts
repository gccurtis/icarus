import { expect, test, type Page, type TestInfo } from "./fixtures";

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

const openOverview = async (page: Page) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const create = page.locator(".area-create");
  if (!(await create.isVisible())) {
    await page
      .getByRole("toolbar", { name: "Open tabs" })
      .getByRole("button", { name: "Overview", exact: true })
      .click();
  }
  await expect(create).toBeVisible();
  return create;
};

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("New Tab Recent and search open represented resources instead of dead tabs", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  const recent = page.locator(".area-recent");
  await expect(recent).toContainText("Winter readiness brief");
  await expect(recent).toContainText("Board review — Q1 exposure");

  await recent.getByRole("button").filter({ hasText: "Winter readiness brief" }).click();
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(tabs.getByText("Disconnected", { exact: true })).toHaveCount(0);

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page
    .locator(".area-recent")
    .getByRole("button")
    .filter({ hasText: "Board review — Q1 exposure" })
    .click();
  await expect(page.locator(".area-title h1")).toHaveText("Board review — Q1 exposure");
  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })).toBeVisible();
  await expect(tabs.getByText("Disconnected", { exact: true })).toHaveCount(0);

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page.getByRole("searchbox", { name: "Search this project" }).fill("Field team briefing");
  await page
    .locator(".area-search")
    .getByRole("button")
    .filter({ hasText: "Field team briefing" })
    .click();
  await expect(page.locator(".area-title h1")).toHaveText("Field team briefing");
  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })).toBeVisible();
  await expect(tabs.getByText("Disconnected", { exact: true })).toHaveCount(0);
});

test("Project Overview creates durable document, presentation, and spreadsheet resources", async ({ page }) => {
  let create = await openOverview(page);
  await create.getByRole("button", { name: "Document", exact: true }).click();

  const editor = page.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  const documentContext = page.locator('aside[aria-label="Context"]');
  await expect(documentContext.getByRole("heading", { name: "Layout" })).toBeVisible();
  await expect(
    documentContext
      .getByRole("navigation", { name: "Context views" })
      .getByRole("button", { name: "Layout" })
  ).toHaveAttribute("aria-current", "true");
  await expect(page.locator('.lane[aria-label="Comment threads"]')).toHaveCount(0);

  const pageGutters = () =>
    page.locator(".canvas").evaluate((canvas) => {
      const paper = canvas.querySelector<HTMLElement>(".document-page");
      if (paper === null) return { leading: Number.POSITIVE_INFINITY, trailing: 0 };

      const surface = canvas.getBoundingClientRect();
      const page = paper.getBoundingClientRect();
      return { leading: page.left - surface.left, trailing: surface.right - page.right };
    });

  await expect
    .poll(
      async () => {
        const gutters = await pageGutters();
        return Math.abs(gutters.leading - gutters.trailing);
      },
      { message: "a new uncommented document should be centered in its pasteboard" }
    )
    .toBeLessThanOrEqual(2);
  await expect
    .poll(
      async () => {
        const gutters = await pageGutters();
        return Math.max(gutters.leading, gutters.trailing);
      },
      { message: "a new uncommented document should fit the available pasteboard width" }
    )
    .toBeLessThanOrEqual(20);
  const documentTitle = (await page.locator(".title-bar h1").textContent())?.trim();
  expect(documentTitle).toMatch(/^Untitled document \d+$/);
  await editor.click();
  await page.keyboard.type("Durable creation proof");
  await expect(editor).toContainText("Durable creation proof");
  await expect(page.locator(".title-bar")).toContainText("Saving");
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  if (!(await editor.isVisible())) {
    await page
      .getByRole("toolbar", { name: "Open tabs" })
      .getByRole("button", { name: "Overview", exact: true })
      .click();
    const search = page.getByPlaceholder("Search this project");
    await search.fill(documentTitle!);
    await page.getByRole("button", { name: documentTitle!, exact: true }).dblclick();
  }
  await expect(editor).toContainText("Durable creation proof");

  await page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  create = page.locator(".area-create");
  await create.getByRole("button", { name: "Presentation", exact: true }).click();

  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })).toBeVisible();
  await expect(page.locator(".area-title h1")).toHaveText(/^Untitled presentation \d+$/);
  const presentationTitle = (await page.locator(".area-title h1").textContent())?.trim();
  expect(presentationTitle).toMatch(/^Untitled presentation \d+$/);
  await expect(
    page.locator('aside[aria-label="Context"]').getByRole("button", { name: "Slide 1", exact: true })
  ).toHaveCount(1);
  const presentationSurface = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
  const presentationContext = page.locator('aside[aria-label="Context"]');
  await presentationContext.getByRole("button", { name: "Insert", exact: true }).click();
  await presentationContext.getByRole("button", { name: "Text box", exact: true }).click();
  const durablePresentationItem = presentationSurface.locator("[data-item]").last();
  await durablePresentationItem.dblclick({ position: { x: 24, y: 18 } });
  await page.keyboard.press("End");
  await page.keyboard.type(" durable presentation proof");
  await expect(durablePresentationItem).toContainText("Text durable presentation proof");
  await expect(page.locator(".area-strip")).toContainText("Saving");
  await expect(page.locator(".area-strip")).toContainText("Saved", { timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".area-title h1")).toHaveText(presentationTitle!);
  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })
    .locator("[data-item]").last()).toContainText("Text durable presentation proof");
  await page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page.locator(".area-resources").getByPlaceholder("Search this project").fill(presentationTitle!);
  await page.locator(".area-resources").getByRole("button", {
    name: presentationTitle!,
    exact: true
  }).dblclick();
  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })
    .locator("[data-item]").last()).toContainText("Text durable presentation proof");

  await page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  create = page.locator(".area-create");
  await create.getByRole("button", { name: "Spreadsheet", exact: true }).click();

  await expect(page.locator(".area-title h1")).toHaveText(/^Untitled spreadsheet \d+$/);
  const spreadsheetTitle = (await page.locator(".area-title h1").textContent())?.trim();
  expect(spreadsheetTitle).toMatch(/^Untitled spreadsheet \d+$/);
  const sheet = page.locator(".sheet-surface");
  await expect(sheet).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(
    page.getByRole("toolbar", { name: "Open tabs" }).getByText("Disconnected", { exact: true })
  ).toHaveCount(0);

  const sheetBox = await sheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  await page.mouse.click((sheetBox?.x ?? 0) + 64, (sheetBox?.y ?? 0) + 38);
  await expect(page.locator('aside[aria-label="Inspector"]')
    .getByRole("heading", { level: 2, name: "A1", exact: true })).toBeVisible();
  await page.keyboard.type("Durable sheet proof");
  const value = page.locator('input[aria-label="Expression"], input[aria-label="Value"]').first();
  await expect(value).toBeFocused();
  await expect(value).toHaveValue("Durable sheet proof");
  await value.press("Enter");
  await page.waitForTimeout(2_800);
  await expect(page.locator(".area-strip")).toContainText("Saved", { timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".area-title h1")).toHaveText(spreadsheetTitle!);
  await expect(page.locator(".sheet-surface")).toBeVisible();
  await expect(page.locator('aside[aria-label="Inspector"]')
    .getByRole("heading", { level: 2, name: "A1", exact: true })).toBeVisible();
  await expect(page.locator('button[aria-label="Expression"], button[aria-label="Value"]')
    .first()).toHaveText("Durable sheet proof");
  await page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page.locator(".area-resources")
    .getByPlaceholder("Search this project")
    .fill(spreadsheetTitle!);
  await page.locator(".area-resources").getByRole("button", {
    name: spreadsheetTitle!,
    exact: true
  }).dblclick();
  await expect(page.locator(".sheet-surface")).toBeVisible();
  await expect(page.locator('button[aria-label="Expression"], button[aria-label="Value"]')
    .first()).toHaveText("Durable sheet proof");
});

test("New Tab creates represented documents, presentations, and spreadsheets instead of title-shaped IDs", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  let launchers = page.locator(".area-editors");
  await launchers.getByRole("button", { name: "Document", exact: true }).click();
  await expect(page.locator(".title-bar h1")).toHaveText(/^Untitled document \d+$/);
  await expect(page.locator(".ProseMirror")).toBeVisible();

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  launchers = page.locator(".area-editors");
  await launchers.getByRole("button", { name: "Presentation", exact: true }).click();
  await expect(page.locator(".area-title h1")).toHaveText(/^Untitled presentation \d+$/);
  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })).toBeVisible();

  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  launchers = page.locator(".area-editors");
  await launchers.getByRole("button", { name: "Spreadsheet", exact: true }).click();
  await expect(page.locator(".area-title h1")).toHaveText(/^Untitled spreadsheet \d+$/);
  await expect(page.locator(".sheet-surface")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(tabs.getByText("Disconnected", { exact: true })).toHaveCount(0);
});

test("Project Overview creates a research chat and explains the unsupported analysis action", async ({ page }) => {
  const create = await openOverview(page);
  await create.getByRole("button", { name: "Research chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Ask the project something.");
  await expect(
    page.getByRole("toolbar", { name: "Open tabs" }).getByRole("button", {
      name: "New chat",
      exact: true
    })
  ).toBeVisible();

  const overview = page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "Overview", exact: true });
  await overview.click();
  const observed = page.waitForEvent("dialog").then(async (opened) => {
    const actual = opened.message();
    await opened.dismiss();
    return actual;
  });
  await page.locator(".area-create").getByRole("button", { name: "Analysis graph" }).click();
  expect(await observed).toBe("Creating a represented analysis graph is not wired up yet.");
});
