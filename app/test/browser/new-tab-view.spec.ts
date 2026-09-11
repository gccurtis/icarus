import { expect, test, type Page, type TestInfo } from "./fixtures";

const tabs = (page: Page) => page.getByRole("toolbar", { name: "Open tabs" });
const launchers = (page: Page) => tabs(page).locator(".tab.named").getByRole("button", { name: "New tab", exact: true });
const resources = (page: Page) => page.locator(".area-resources");
const inspector = (page: Page) => page.locator('aside[aria-label="Inspector"]');
const context = (page: Page) => page.locator('aside[aria-label="Context"]');
const diagnostics: string[] = [];

const workspaceSaved = (page: Page, operation: string) => page.waitForResponse((response) => {
  if (response.request().method() !== "POST" || !response.url().includes("submitWorkspaceChanges")) return false;
  const request = response.request().postDataJSON();
  return typeof request?.payload === "string" &&
    Buffer.from(request.payload, "base64url").toString("utf8").includes(JSON.stringify(operation));
});

const openNewTab = async (page: Page) => {
  await tabs(page).locator('button.tab.icon[aria-label="New tab"]').click();
  await expect(page.locator(".launcher-board")).toBeVisible();
  await expect(resources(page).getByRole("table")).toBeVisible();
};

const visitNewTab = async (page: Page) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await openNewTab(page);
};

const inspectLayout = async (page: Page, info: TestInfo, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.locator(".recent-card > button").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { width: box.width, height: box.height };
    })
  );
  expect(bounds.length).toBeGreaterThan(2);
  for (const dimension of ["width", "height"] as const) {
    const values = bounds.map((box) => box[dimension]);
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(Math.max(...values) - Math.min(...values), `${name}: uniform card ${dimension}`).toBeLessThanOrEqual(1);
  }
  const overflowing = await page.locator(".create-actions button").evaluateAll((buttons) =>
    buttons.filter((button) => button.scrollWidth > button.clientWidth + 2).map((button) => button.textContent?.trim())
  );
  expect(overflowing, `${name}: create labels fit their buttons`).toEqual([]);
  const scrolling = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(".launcher-surface")!;
    const table = document.querySelector<HTMLElement>(
      '.area-resources [data-slot="table-container"]'
    )!;
    return {
      surfaceClient: surface.clientHeight,
      surfaceScroll: surface.scrollHeight,
      tableClient: table.clientHeight,
      tableScroll: table.scrollHeight
    };
  });
  expect(scrolling.surfaceScroll - scrolling.surfaceClient, `${name}: launcher owns no scroll`).toBeLessThanOrEqual(1);
  expect(scrolling.tableScroll, `${name}: resource rows scroll inside the table`).toBeGreaterThan(scrolling.tableClient);
  await page.locator(".area-create").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
};

test.beforeEach(async ({ page }) => {
  diagnostics.length = 0;
  page.on("pageerror", (error) => diagnostics.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(() => {
  expect(diagnostics, "unexpected browser errors").toEqual([]);
});

test("New Tab has colored creation actions and uniform recents at wide, compact, and zoomed sizes", async ({ page }, info) => {
  await visitNewTab(page);
  await expect(page.locator(".area-create").getByText("Create", { exact: true })).toBeVisible();
  await expect(page.locator(".area-recent").getByText("Recent", { exact: true })).toBeVisible();
  await expect(page.locator(".area-recent").getByText("8", { exact: true })).toHaveCount(0);
  await expect(page.locator(".area-search, .area-templates")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("searchbox")).toHaveCount(1);
  await expect(page.getByRole("main")).not.toContainText(/body entity.*variable key/i);
  await expect(context(page).getByRole("heading", { name: "Templates", exact: true })).toBeVisible();

  const choices = [
    ["Document", "interactive"], ["Presentation", "accent-1"], ["Spreadsheet", "accent-2"],
    ["Research chat", "intelligence"], ["Analysis graph", "secondary"]
  ];
  for (const [label, tone] of choices) {
    const button = page.locator(".area-create").getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    const colors = await button.evaluate((node, token) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(--token-color-${token}-surface)`;
      probe.style.color = `var(--token-color-${token}-text)`;
      node.append(probe);
      const actual = getComputedStyle(node);
      const expected = getComputedStyle(probe);
      const result = { background: actual.backgroundColor, text: actual.color, expectedBackground: expected.backgroundColor, expectedText: expected.color };
      probe.remove();
      return result;
    }, tone);
    expect(colors.background, `${label} background`).toBe(colors.expectedBackground);
    expect(colors.text, `${label} text`).toBe(colors.expectedText);
  }
  await inspectLayout(page, info, "new-tab-wide");
  await page.setViewportSize({ width: 1180, height: 800 });
  await inspectLayout(page, info, "new-tab-compact");
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  await inspectLayout(page, info, "new-tab-compact-125-percent");
  await resources(page).getByRole("searchbox").fill("Winter readiness");
  await expect(resources(page).getByRole("button", { name: "Winter readiness brief", exact: true })).toBeVisible();
  await resources(page).getByRole("button", { name: "Winter readiness brief", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("new-tab-compact-125-percent-table.png") });
});

test("the resource table filters, sorts, inspects, and opens with double-click or Enter", async ({ page }) => {
  await visitNewTab(page);
  const table = resources(page);
  const rows = table.locator("tbody tr");
  const search = table.getByRole("searchbox");
  const kind = table.getByRole("combobox", { name: "Kind", exact: true });
  const actor = table.getByRole("combobox", { name: "Updated by", exact: true });
  const widths = await Promise.all([search.locator(".."), kind, actor].map(async (control) =>
    (await control.boundingBox())!.width
  ));
  expect(widths[0]).toBeGreaterThan(widths[1]);
  expect(widths[0]).toBeGreaterThan(widths[2]);
  await expect(actor).toHaveAttribute("title", "Anyone");
  await expect(actor.locator('option[value="all"]')).toHaveAttribute("title", "Anyone");
  await kind.selectOption("document");
  await expect(rows).toHaveCount(4);
  await actor.selectOption({ label: "Mira Okonkwo" });
  await expect(actor).toHaveAttribute("title", "Mira Okonkwo");
  await expect(actor.locator('option[value="Mira Okonkwo"]')).toHaveAttribute("title", "Mira Okonkwo");
  await expect(rows).toHaveCount(2);
  await expect(rows.locator("td:nth-child(4)")).toHaveText(["Mira Okonkwo", "Mira Okonkwo"]);
  await table.getByRole("searchbox").fill("Winter readiness");
  await expect(rows).toHaveCount(1);
  await table.getByRole("searchbox").fill("no resource has this title");
  await expect(table.getByText("Nothing in this project matches", { exact: true })).toBeVisible();
  await table.getByRole("button", { name: "Clear the filter", exact: true }).click();
  await expect(table.getByRole("combobox", { name: "Kind", exact: true })).toHaveValue("all");
  await expect(table.getByRole("combobox", { name: "Updated by", exact: true })).toHaveValue("all");
  await table.getByRole("button", { name: "Order", exact: true }).click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  const ascending = await rows.locator("td:first-child button").allTextContents();
  expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b)));
  await table.getByRole("button", { name: "A to Z", exact: true }).click();
  await expect(rows.locator("td:first-child button")).toHaveText([...ascending].reverse());

  await table.getByRole("searchbox").fill("Winter readiness brief");
  const document = table.getByRole("button", { name: "Winter readiness brief", exact: true });
  await document.click();
  await expect(inspector(page)).toHaveAttribute("data-inspected", "project-overview.resource");
  await expect(inspector(page).getByRole("heading", { name: "Winter readiness brief", exact: true })).toBeVisible();
  await inspector(page).getByRole("button", { name: "Resources", exact: true }).click();
  await expect(inspector(page)).toHaveAttribute("data-inspected", "empty");
  await document.click();
  await expect(launchers(page)).toHaveCount(1);
  await document.dblclick();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(launchers(page)).toHaveCount(0);
  await openNewTab(page);
  await table.getByRole("searchbox").fill("Field team briefing");
  await table.getByRole("button", { name: "Field team briefing", exact: true }).press("Enter");
  await expect(page.locator(".area-title h1")).toHaveText("Field team briefing");
  await expect(launchers(page)).toHaveCount(0);
});

test("resource tables omit redundant matched totals in New Tab and Project Overview", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await expect(resources(page).getByText(/^\d+ of \d+$/, { exact: true })).toHaveCount(0);
  await openNewTab(page);
  await expect(resources(page).getByText(/^\d+ of \d+$/, { exact: true })).toHaveCount(0);
  await resources(page).getByRole("combobox", { name: "Kind", exact: true }).selectOption("research");
  await expect.poll(async () => [...new Set(
    (await resources(page).locator("tbody tr td:nth-child(2)").allTextContents()).map((text) => text.trim())
  )]).toEqual(["Research"]);
  await expect(resources(page).getByText(/^\d+ of \d+$/, { exact: true })).toHaveCount(0);
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
  await expect(resources(page).getByText(/^\d+ of \d+$/, { exact: true })).toHaveCount(0);
});

test("New Tab offers real chat and spreadsheet actions, with an alert-only finding action", async ({ page }, info) => {
  await visitNewTab(page);
  await resources(page).getByRole("button", { name: "Three feeders carry 41% of customer-minutes", exact: true }).click();
  const finding = inspector(page).getByRole("button", { name: "Open finding", exact: true });
  await expect(finding).toBeVisible();
  await page.screenshot({ path: info.outputPath("new-tab-finding-action.png") });
  const dialog = page.waitForEvent("dialog").then(async (opened) => {
    const message = opened.message();
    await opened.dismiss();
    return message;
  });
  await finding.click();
  expect(await dialog).toBe("Opening a finding in its own view is not wired up yet.");
  await expect(launchers(page)).toHaveCount(1);
  await expect(finding).toBeVisible();

  await resources(page).getByRole("button", { name: "What is the binding winter constraint?", exact: true }).click();
  await inspector(page).getByRole("button", { name: "Open chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
  await expect(tabs(page).locator('button.face[aria-current="page"]')).toContainText("What is the binding winter constraint?");
  await expect(launchers(page)).toHaveCount(0);

  await openNewTab(page);
  await resources(page).getByRole("button", { name: "Outage minutes by substation", exact: true }).click();
  await inspector(page).getByRole("button", { name: "Open spreadsheet", exact: true }).click();
  await expect(page.locator(".area-title h1")).toHaveText("Outage minutes by substation");
  await expect(launchers(page)).toHaveCount(0);
});

test("resource inspection and launcher consumption survive workspace reloads", async ({ page }) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const saved = (operation: string) => workspaceSaved(page, operation);
  const initial = saved("open");
  await openNewTab(page);
  expect((await (await initial).json()).type).toBe("result");
  const selected = saved("inspect");
  await resources(page).getByRole("button", { name: "Winter readiness brief", exact: true }).click();
  expect((await (await selected).json()).type).toBe("result");
  await page.reload({ waitUntil: "networkidle" });
  await expect(launchers(page)).toHaveCount(1);
  await expect(inspector(page)).toHaveAttribute("data-inspected", "project-overview.resource");
  await expect(inspector(page).getByRole("heading", { name: "Winter readiness brief", exact: true })).toBeVisible();

  const opened = saved("close");
  await inspector(page).getByRole("button", { name: "Open document", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  expect((await (await opened).json()).type).toBe("result");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  await expect(launchers(page)).toHaveCount(0);
});

test("recents inspect before opening and consume only their originating launcher", async ({ page }) => {
  await visitNewTab(page);
  await openNewTab(page);
  await expect(launchers(page)).toHaveCount(2);
  await launchers(page).first().click();
  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
  await expect(launchers(page)).toHaveCount(2);
  await launchers(page).first().click();
  const recent = page.locator(".area-recent").getByRole("button").filter({ hasText: "Winter readiness brief" });
  await recent.click();
  await expect(recent).toHaveAttribute("aria-pressed", "true");
  await expect(inspector(page)).toHaveAttribute("data-inspected", "project-overview.resource");
  await expect(launchers(page)).toHaveCount(2);
  await recent.press("Enter");
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  await expect(launchers(page)).toHaveCount(1);
  await launchers(page).click();
  await expect(recent).toHaveAttribute("aria-pressed", "false");
  await recent.dblclick();
  await expect(launchers(page)).toHaveCount(0);
  await expect(tabs(page).getByRole("button", { name: "Winter readiness brief", exact: true })).toHaveCount(1);
  await expect(tabs(page).getByRole("button", { name: "Winter readiness brief", exact: true })).toHaveAttribute("aria-current", "page");
});

test("Analysis explains its limit while Research creates a focused chat", async ({ page }) => {
  await visitNewTab(page);
  const dialog = page.waitForEvent("dialog").then(async (opened) => {
    const message = opened.message();
    await opened.dismiss();
    return message;
  });
  await page.locator(".area-create").getByRole("button", { name: "Analysis graph", exact: true }).click();
  expect(await dialog).toBe("Creating a represented analysis graph is not wired up yet.");
  await expect(launchers(page)).toHaveCount(1);
  await expect(launchers(page)).toHaveAttribute("aria-current", "page");
  await page.locator(".area-create").getByRole("button", { name: "Research chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
  await expect(tabs(page).getByRole("button", { name: "New chat", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(launchers(page)).toHaveCount(0);
});

for (const [name, kind] of [["Incident write-up", "document"], ["Board review", "presentation"]] as const) {
  test(`the template context creates a ${kind} using saved defaults`, async ({ page }) => {
    await visitNewTab(page);
    await context(page).getByRole("button", { name: `Inspect ${name} template`, exact: true }).dblclick();
    const editor = kind === "document" ? page.locator(".ProseMirror") : page.locator(".area-canvas").getByRole("application", { name: "Slide" });
    await expect(editor).toBeVisible();
    await expect(launchers(page)).toHaveCount(0);
    await expect(tabs(page).locator('button.face[aria-current="page"]')).toContainText(name);
  });
}

test("template Enter matches single-click inspection before double-click opens it", async ({ page }, info) => {
  await visitNewTab(page);
  const chosen = context(page).getByRole("button", { name: "Inspect Incident write-up template", exact: true });
  const saved = workspaceSaved(page, "templates.template");
  await chosen.click();
  await expect(chosen).toHaveAttribute("aria-pressed", "true");
  await expect(inspector(page)).toHaveAttribute("data-inspected", "templates.template");
  await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText("Incident write-up");
  await expect(inspector(page).getByRole("button", { name: "Use template", exact: true })).toBeVisible();
  await expect(launchers(page)).toHaveCount(1);
  expect((await (await saved).json()).type).toBe("result");
  await page.reload({ waitUntil: "networkidle" });
  await expect(chosen).toHaveAttribute("aria-pressed", "true");
  await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText("Incident write-up");
  await page.screenshot({ path: info.outputPath("new-tab-template-inspection-wide.png") });

  await page.setViewportSize({ width: 1180, height: 800 });
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  await expect(inspector(page).getByRole("button", { name: "Use template", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("new-tab-template-inspection-compact.png") });
  await chosen.press("Enter");
  await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText("Incident write-up");
  await expect(launchers(page)).toHaveCount(1);
  await expect(page.locator(".ProseMirror")).toHaveCount(0);
  const consumed = workspaceSaved(page, "close");
  await chosen.dblclick();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  expect((await (await consumed).json()).type).toBe("result");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(launchers(page)).toHaveCount(0);
});

test("a template with missing required words keeps its launcher and offers the library", async ({ page }) => {
  await visitNewTab(page);
  await context(page).getByRole("button", { name: "Inspect Technical glossary template", exact: true }).dblclick();
  await expect(context(page)).toContainText("these need words before the template can be placed: subject_line");
  await expect(launchers(page)).toHaveCount(1);
  await resources(page).getByRole("button", { name: "Winter readiness brief", exact: true }).click();
  await expect(context(page)).toContainText("these need words before the template can be placed: subject_line");
  await expect(launchers(page)).toHaveCount(1);
  await context(page).getByRole("button", { name: "Choose template inputs in the library", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: "Templates", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText("Technical glossary");
  await expect(launchers(page)).toHaveCount(0);
});

test("one New Tab admits only one durable command across launcher surfaces", async ({ page }) => {
  await visitNewTab(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let creationWaiting = false;
  let templateRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("instantiateTemplate")) {
      templateRequests += 1;
    }
  });
  await page.route("**/remote/**", async (route) => {
    if (route.request().method() !== "POST" || !route.request().url().includes("createProjectResource")) {
      return route.fallback();
    }
    creationWaiting = true;
    await gate;
    await route.continue();
  });

  try {
    await page.locator(".area-create").getByRole("button", { name: "Document", exact: true }).click();
    await expect.poll(() => creationWaiting).toBe(true);
    await context(page).getByRole("button", { name: "Inspect Incident write-up template", exact: true }).dblclick();
    await expect(context(page)).toContainText("Another New Tab action is already in progress.");
    await expect.poll(() => templateRequests).toBe(0);
    release();
    await expect(page.locator(".ProseMirror")).toBeVisible();
    await expect(launchers(page)).toHaveCount(0);
  } finally {
    release();
  }
});

test("an empty template library offers a shortcut without changing stored templates", async ({ page }) => {
  // Preserve the real query envelope while emptying just its library projection.
  await page.route("**/remote/**", async (route) => {
    if (!route.request().url().includes("readTemplateLibrary")) return route.fallback();
    const response = await route.fetch();
    const envelope = await response.json();
    const flattened = JSON.parse(envelope.data);
    const library = flattened.find((value: unknown) =>
      value !== null && typeof value === "object" && "templates" in value && "unavailable" in value
    );
    expect(library, "real template query projection").toBeDefined();
    library.templates = flattened.length;
    flattened.push([]);
    library.unavailable = flattened.length;
    flattened.push([]);
    await route.fulfill({ response, json: { ...envelope, data: JSON.stringify(flattened) } });
  });
  await visitNewTab(page);
  await expect(context(page).getByText("Start with a template of your own.", { exact: true })).toBeVisible();
  await context(page).getByRole("button", { name: "Create template", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: "Templates", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").getByRole("heading", { name: "Templates", exact: true })).toBeVisible();
  await expect(launchers(page)).toHaveCount(0);
});

test("a delayed creation does not steal focus or consume a remounted launcher", async ({ page }) => {
  await visitNewTab(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let waiting = false;
  await page.route("**/remote/**", async (route) => {
    if (route.request().method() !== "POST" || !route.request().url().includes("createProjectResource")) return route.fallback();
    waiting = true;
    await gate;
    await route.continue();
  });
  try {
    await page.locator(".area-create").getByRole("button", { name: "Presentation", exact: true }).click();
    await expect.poll(() => waiting).toBe(true);
    await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
    await expect(launchers(page)).toHaveCount(1);
    await launchers(page).click();
    const response = page.waitForResponse((answer) => answer.request().method() === "POST" && answer.url().includes("createProjectResource"));
    release();
    await response;
    await expect(resources(page).getByRole("button", { name: /^Untitled presentation \d+$/, exact: true })).toBeVisible();
    await expect(launchers(page)).toHaveCount(1);
    await expect(launchers(page)).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".area-canvas")).toHaveCount(0);
  } finally {
    release();
  }
});

test("a failed creation keeps the launcher available for retry", async ({ page }) => {
  await visitNewTab(page);
  await page.route("**/remote/**", async (route) => {
    if (route.request().method() !== "POST" || !route.request().url().includes("createProjectResource")) return route.fallback();
    await route.fulfill({ json: { type: "error", status: 503, error: { message: "Creation paused for this test" } } });
  });
  const create = page.locator(".area-create").getByRole("button", { name: "Document", exact: true });
  await create.click();
  await expect(page.locator(".area-create")).toContainText("Creation paused for this test");
  await expect(create).toBeEnabled();
  await expect(launchers(page)).toHaveCount(1);
  await page.unroute("**/remote/**");
  await create.click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(launchers(page)).toHaveCount(0);
});
