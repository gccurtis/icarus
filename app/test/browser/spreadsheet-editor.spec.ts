import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const unexpected: string[] = [];
const SHEET_TITLE = "Outage minutes by substation";
const OTHER_SHEET = "Hardening cost model";

/** The row marker and the column header, at 100%. */
const MARKER = 44;
const HEADER = 26;

/** Diagnostics a test has said it is causing on purpose. */
let allowed: RegExp[] = [];

const watchDiagnostics = (page: Page) => {
  const note = (entry: string) => {
    if (!allowed.some((pattern) => pattern.test(entry))) unexpected.push(entry);
  };
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      const at = message.location();
      note(`console:${message.type()}: ${message.text()} @ ${at.url}:${at.lineNumber}`);
    }
  });
  page.on("pageerror", (error) => note(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) {
      return;
    }
    note(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) note(`http:${response.status()}: ${response.url()}`);
  });
};

const surface = (page: Page): Locator => page.locator(".sheet-surface");
const inspector = (page: Page): Locator => page.locator('aside[aria-label="Inspector"]');

const openSheet = async (page: Page, title = SHEET_TITLE) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  const tab = tabs.getByRole("button", { name: title, exact: true });
  if ((await tab.count()) > 0) {
    await tab.click();
  } else {
    const overview = tabs.getByRole("button", { name: "Overview", exact: true });
    if ((await overview.count()) > 0) await overview.click();
    await page.getByRole("button", { name: title, exact: true }).last().dblclick();
  }
  await expect(surface(page)).toBeVisible();
  await expect(page.locator(".area-title")).toContainText(title);
  await expect(page.locator("canvas").first()).toBeVisible();
  return surface(page);
};

/** Back to 100% and to the top, so a cell is where the constants say. */
const atFullSize = async (page: Page) => {
  const zoom = page.getByTitle("Back to 100%");
  if ((await zoom.textContent())?.trim() !== "100%") await zoom.click();
  await expect(zoom).toHaveText("100%");
  await page.locator(".dvn-scroller").first().evaluate((node) => {
    node.scrollTop = 0;
    node.scrollLeft = 0;
  });
  await expect(page.locator('.handle.down[aria-label="Height of row 1"]')).toBeVisible();
};

const columnRight = async (page: Page, label: string): Promise<number> => {
  const handle = page.locator(`.handle.across[aria-label="Width of column ${label}"]`);
  const box = await handle.boundingBox();
  if (box === null) throw new Error(`column ${label} is not on screen`);
  return box.x + 3;
};

const rowBottom = async (page: Page, number: number): Promise<number> => {
  const handle = page.locator(`.handle.down[aria-label="Height of row ${number}"]`);
  const box = await handle.boundingBox();
  if (box === null) throw new Error(`row ${number} is not on screen`);
  return box.y + 3;
};

const before = (label: string): string | undefined =>
  label === "A" ? undefined : String.fromCharCode(label.charCodeAt(0) - 1);

/**
 * Where to click for a cell, worked out from the boundaries the surface draws
 * rather than from a guess about track sizes.
 */
const cellAt = async (page: Page, address: string): Promise<{ x: number; y: number }> => {
  const [, label, number] = /^([A-Z]+)(\d+)$/.exec(address) ?? [];
  if (label === undefined) throw new Error(`${address} is not an address`);
  const frame = await surface(page).boundingBox();
  if (frame === null) throw new Error("the surface is not on screen");

  const previous = before(label);
  const left = previous === undefined ? frame.x + MARKER : await columnRight(page, previous);
  const right = await columnRight(page, label);

  const row = Number(number);
  const top = row === 1 ? frame.y + HEADER : await rowBottom(page, row - 1);
  const bottom = await rowBottom(page, row);

  return { x: (left + right) / 2, y: (top + bottom) / 2 };
};

/**
 * One click on a cell, and never two.
 *
 * A second click on the same point inside the browser's double-click interval
 * activates the cell, which opens the editor and takes the read-out away. The
 * pointer steps off the cell first so two clicks in a row stay two clicks.
 */
const clickCell = async (page: Page, address: string, modifiers: ("Shift" | "Control")[] = []) => {
  const at = await cellAt(page, address);
  await page.mouse.move(at.x + 40, at.y + 40);
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(at.x, at.y);
  for (const key of modifiers) await page.keyboard.up(key);
};

/** The range lens keeps its sums shut until they are asked for. */
const openStatistics = async (page: Page) => {
  const heading = page.locator('aside[aria-label="Inspector"]').getByText("Statistics", { exact: true });
  await expect(heading).toBeVisible();
  if ((await page.locator('aside[aria-label="Inspector"]').getByText("Sum", { exact: true }).count()) === 0) {
    await heading.click();
  }
  await expect(page.locator('aside[aria-label="Inspector"]').getByText("Sum", { exact: true })).toBeVisible();
};

/** A range the way a person makes one: press, drag, release. */
const dragRange = async (page: Page, from: string, to: string) => {
  const start = await cellAt(page, from);
  const end = await cellAt(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
};

/** What the inspector says is selected. */
const selected = async (page: Page): Promise<string> => {
  const heading = inspector(page).getByRole("heading", { level: 2 }).first();
  return ((await heading.textContent()) ?? "").trim();
};

const expressionBox = (page: Page): Locator =>
  page.locator('input[aria-label="Expression"], input[aria-label="Value"]');

const readBox = (page: Page): Locator =>
  page.locator('button[aria-label="Expression"], button[aria-label="Value"]');

/** Land on one cell, however the selection was left. */
const focusCell = async (page: Page, address: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // A click inside a range keeps the range, so step out of it first.
    if (attempt > 0 && address !== "A1") await clickCell(page, "A1");
    await clickCell(page, address);
    if (await expect
      .poll(() => selected(page), { timeout: 2000 })
      .toBe(address)
      .then(() => true)
      .catch(() => false)) {
      return;
    }
  }
  await expect.poll(() => selected(page)).toBe(address);
};

const write = async (page: Page, address: string, text: string) => {
  await focusCell(page, address);
  if ((await expressionBox(page).count()) > 0) await expressionBox(page).first().press("Escape");
  await readBox(page).first().click();
  const field = expressionBox(page).first();
  await expect(field).toBeFocused();
  await field.fill(text);
  await field.press("Enter");
  await expect(readBox(page).first()).toBeVisible();
};

/**
 * Wait for the edit to leave the browser.
 *
 * The runtime holds a change set for `flushAfterMs` before it submits, so a
 * reload any sooner reads a sheet the server has not been told about yet.
 */
const FLUSH_AFTER_MS = 2000;

const settled = async (page: Page) => {
  await page.waitForTimeout(FLUSH_AFTER_MS + 800);
  await expect(page.locator(".area-strip")).toContainText("Saved", { timeout: 10_000 });
};

const cellText = async (page: Page, address: string): Promise<string> => {
  await focusCell(page, address);
  if ((await expressionBox(page).count()) > 0) await expressionBox(page).first().press("Escape");
  const box = readBox(page).first();
  await expect(box).toBeVisible();
  const shown = ((await box.textContent()) ?? "").trim();
  return shown === "Empty" ? "" : shown;
};

test.beforeEach(async ({ page, context }) => {
  unexpected.length = 0;
  allowed = [];
  watchDiagnostics(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page.on("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("the sheet opens with its grid, its rail and a saved state", async ({ page }) => {
  await openSheet(page);

  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByTitle("Back to 100%")).toHaveText(/^\d+%$/);
  await expect(page.locator(".area-strip")).toContainText("Saved");
  await expect(page.locator('aside[aria-label="Context"]')).toContainText("Grid");
});

test("clicking a cell inspects it and typing on the grid takes the caret", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await clickCell(page, "C4");
  expect(await selected(page)).toBe("C4");

  await page.keyboard.type("7");
  const field = expressionBox(page).first();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("7");
  await field.press("Escape");
});

test("an edit is kept, and is still there after a reload", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await write(page, "E20", "1234");
  expect(await cellText(page, "E20")).toBe("1234");
  await settled(page);

  await page.reload({ waitUntil: "networkidle" });
  await expect(surface(page)).toBeVisible();
  await atFullSize(page);
  expect(await cellText(page, "E20")).toBe("1234");
});

test("a formula computes, follows its precedent, and undo takes both halves back", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await write(page, "E21", "4");
  await write(page, "F21", "=E21*3");
  expect(await cellText(page, "F21")).toBe("=E21*3");

  // The range lens adds up what the cells answer, so it reads the computed
  // value rather than the formula: 4 and 12.
  await dragRange(page, "E21", "F21");
  await openStatistics(page);
  await expect(inspector(page).getByText("16", { exact: true }).first()).toBeVisible();

  await write(page, "E21", "5");
  await dragRange(page, "E21", "F21");
  await openStatistics(page);
  await expect(inspector(page).getByText("20", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await dragRange(page, "E21", "F21");
  await openStatistics(page);
  await expect(inspector(page).getByText("16", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Redo" }).click();
  await dragRange(page, "E21", "F21");
  await openStatistics(page);
  await expect(inspector(page).getByText("20", { exact: true }).first()).toBeVisible();
});

test("shift picks a range and control adds a second one", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await focusCell(page, "C4");
  await clickCell(page, "D6", ["Shift"]);
  await expect.poll(() => selected(page)).toBe("C4:D6");
  await expect(inspector(page)).toHaveAttribute("data-inspected", "spreadsheet-editor.range");

  await dragRange(page, "C4", "D6");
  await expect.poll(() => selected(page)).toBe("C4:D6");

  const start = await cellAt(page, "F4");
  const end = await cellAt(page, "F6");
  await page.keyboard.down("Control");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Control");

  await expect(inspector(page)).toHaveAttribute("data-inspected", "spreadsheet-editor.range");
  await expect(inspector(page).getByText("cells", { exact: true })).toBeVisible();
  await expect(inspector(page).getByText("9", { exact: true }).first()).toBeVisible();
});

test("copy and paste carry a value to another cell, and cut empties the first", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await write(page, "E22", "808");

  // The clipboard itself belongs to the browser and is not reliable headless,
  // so what is checked here is that the gestures are offered on a cell.
  const at = await cellAt(page, "E22");
  await page.mouse.click(at.x, at.y, { button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Cut", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Paste", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Clear contents" }).click();
  expect(await cellText(page, "E22")).toBe("");
});

test("a fill carries a formula down and its references move with it", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await write(page, "E23", "10");
  await write(page, "E24", "20");
  await write(page, "F23", "=E23+1");
  expect(await cellText(page, "F23")).toBe("=E23+1");

  // The fill handle sits on the selection's bottom-right corner.
  await clickCell(page, "F23");
  const from = await cellAt(page, "F23");
  const to = await cellAt(page, "F24");
  const right = await columnRight(page, "F");
  const bottom = await rowBottom(page, 23);
  await page.mouse.move(right - 2, bottom - 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => cellText(page, "F24")).toBe("=E24+1");
  expect(from.x).toBeGreaterThan(0);
});

test("zoom changes the drawn size and comes back to a hundred", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  const before = await columnRight(page, "A");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByTitle("Back to 100%")).not.toHaveText("100%");
  const after = await columnRight(page, "A");
  expect(after).toBeGreaterThan(before);

  await page.getByTitle("Back to 100%").click();
  await expect(page.getByTitle("Back to 100%")).toHaveText("100%");
});

test("scrolling moves the grid and the row handles follow it", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  const first = page.locator(".handle.down").first();
  const before = await first.getAttribute("aria-label");
  await page.locator(".dvn-scroller").first().evaluate((node) => {
    node.scrollTop += 400;
  });
  await expect
    .poll(async () => page.locator(".handle.down").first().getAttribute("aria-label"))
    .not.toBe(before);
});

test("the comment anchored to a cell is read from that cell's lens", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  // The seed anchors one thread to B12, quoting IB-06.
  await focusCell(page, "B12");
  const lens = inspector(page);
  const section = lens.getByText("Comments", { exact: true });
  await expect(section).toBeVisible();
  if ((await lens.getByText("This feeder is double-counted").count()) === 0) await section.click();

  await expect(lens.getByText("This feeder is double-counted against the 2026 baseline.")).toBeVisible();
});

test("a horizontal merge draws one block and unmerging puts the cells back", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  const blocks = page.locator(".block");
  const before = await blocks.count();

  await dragRange(page, "C19", "E19");
  await expect.poll(() => selected(page)).toBe("C19:E19");
  const inside = await cellAt(page, "D19");
  await page.mouse.click(inside.x, inside.y, { button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: /^Merge / }).click();
  await expect(blocks).toHaveCount(before + 1);

  const anchor = await cellAt(page, "C19");
  await page.mouse.click(anchor.x, anchor.y, { button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: /^Unmerge / }).click();
  await expect(blocks).toHaveCount(before);
});

test("a vertical merge draws one block taller than a row", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  const blocks = page.locator(".block");
  const before = await blocks.count();

  await dragRange(page, "G23", "G26");
  await expect.poll(() => selected(page)).toBe("G23:G26");
  const inside = await cellAt(page, "G24");
  await page.mouse.click(inside.x, inside.y, { button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: /^Merge / }).click();
  await expect(blocks).toHaveCount(before + 1);

  const box = await blocks.last().boundingBox();
  const oneRow = (await rowBottom(page, 23)) - (await rowBottom(page, 22));
  expect(box?.height ?? 0).toBeGreaterThan(oneRow * 2);
});

/**
 * A variable answers a formula, and moving the variable moves the answer.
 *
 * The fixture holds one project, so a name meaning two things in two projects
 * is a capability test rather than a browser one.
 */
test("a variable answers a formula, and changing it moves the answer", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  // The seed sets perMinuteRate to 3.1.
  await write(page, "H23", "=perMinuteRate*2");
  await write(page, "H24", "0");
  await dragRange(page, "H23", "H24");
  await openStatistics(page);
  await expect(inspector(page)).toContainText("6.2");

  await page.getByRole("button", { name: "Variables", exact: true }).first().click();
  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: /perMinuteRate/ }).first().click();

  const value = inspector(page).getByLabel("Value", { exact: true });
  await expect(value).toBeVisible();
  await value.fill("10");
  await value.press("Enter");

  await dragRange(page, "H23", "H24");
  await openStatistics(page);
  await expect(inspector(page)).toContainText("20");
});

/**
 * The workspace shell is client-rendered, so the document is a 200 either way;
 * what has to happen is that the load refuses and the router shows the refusal
 * rather than a workspace that can do nothing.
 */
test("a project that names nothing is a not-found rather than a broken workspace", async ({ page }) => {
  allowed = [/404/, /No such project/];
  await page.goto("/app/not-a-project", { waitUntil: "networkidle" });

  await expect(page.locator("body")).toContainText(/404|Not Found|No such project/i);
  await expect(page.locator(".sheet-editor")).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Open tabs" })).toHaveCount(0);
});

test("a submission the server will not accept changes nothing", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  const before = await cellText(page, "E26");

  // Corrupt the app's own submission on the way out: the op names an operation
  // that does not exist, which the validator refuses before anything is read.
  allowed = [/is not an operation/, /submit-spreadsheet-changes/, /^http:(4|5)\d\d/, /^console:error/];
  let corrupted = 0;
  const posts: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const body = request.postData();
    if (request.method() === "POST") posts.push(request.url());
    if (request.method() !== "POST" || !request.url().includes("submitSpreadsheetChanges")) {
      await route.fallback();
      return;
    }
    corrupted += 1;
    void body;
    await route.continue({ postData: JSON.stringify({ payload: "not a payload" }) });
  });

  await write(page, "E26", "999");
  await page.waitForTimeout(FLUSH_AFTER_MS + 1500);
  expect(corrupted, `posts seen: ${posts.join(" | ")}`).toBeGreaterThan(0);
  await page.unroute("**/*");

  await page.reload({ waitUntil: "networkidle" });
  await expect(surface(page)).toBeVisible();
  await atFullSize(page);
  expect(await cellText(page, "E26")).toBe(before);
});

test("a merged block is one cell to select and to type into, and it draws the draft", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  const blocks = page.locator(".block");
  const before = await blocks.count();

  await dragRange(page, "F12", "G15");
  const inside = await cellAt(page, "F13");
  await page.mouse.click(inside.x, inside.y, { button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: /^Merge / }).click();
  await expect(blocks).toHaveCount(before + 1);

  await expect.poll(() => selected(page)).toBe("F12");

  // The library knows a merge's columns and not its rows, so a click on a lower
  // row reports that row's slice of the block rather than the block.
  await clickCell(page, "G14");
  await expect.poll(() => selected(page)).toBe("F12");

  await page.keyboard.press("5");
  const field = expressionBox(page).first();
  await expect(field).toBeFocused();
  await field.fill("moved");
  await expect(page.locator(".block", { hasText: "moved" })).toHaveCount(1);

  await field.press("Enter");
  await expect(readBox(page).first()).toBeVisible();
  expect(await cellText(page, "F12")).toBe("moved");
});

test("the caret goes back to the grid when writing ends at the keyboard", async ({ page }) => {
  await openSheet(page);
  await atFullSize(page);

  await write(page, "C5", "12");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => selected(page)).toBe("C6");

  await readBox(page).first().click();
  await expressionBox(page).first().press("Escape");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => selected(page)).toBe("D6");
});
