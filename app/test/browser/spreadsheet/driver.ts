import { expect, type Locator, type Page } from "../fixtures";

const SHEET_TITLE = "Outage minutes by substation";
const MARKER = 44;
const HEADER = 26;

export const surface = (page: Page): Locator => page.locator(".sheet-surface");
export const inspector = (page: Page): Locator => page.locator('aside[aria-label="Inspector"]');

export const openSheet = async (page: Page, title = SHEET_TITLE) => {
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
export const atFullSize = async (page: Page) => {
  const zoom = page.getByTitle("Back to 100%");
  if ((await zoom.textContent())?.trim() !== "100%") await zoom.click();
  await expect(zoom).toHaveText("100%");
  await page.locator(".dvn-scroller").first().evaluate((node) => {
    node.scrollTop = 0;
    node.scrollLeft = 0;
  });
  await expect(page.locator('.handle.down[aria-label="Height of row 1"]')).toBeVisible();
};

export const columnRight = async (page: Page, label: string): Promise<number> => {
  const handle = page.locator(`.handle.across[aria-label="Width of column ${label}"]`);
  const box = await handle.boundingBox();
  if (box === null) throw new Error(`column ${label} is not on screen`);
  return box.x + 3;
};

export const rowBottom = async (page: Page, number: number): Promise<number> => {
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
export const cellAt = async (page: Page, address: string): Promise<{ x: number; y: number }> => {
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
export const clickCell = async (page: Page, address: string, modifiers: ("Shift" | "Control")[] = []) => {
  const at = await cellAt(page, address);
  await page.mouse.move(at.x + 40, at.y + 40);
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(at.x, at.y);
  for (const key of modifiers) await page.keyboard.up(key);
};

/** The range lens keeps its sums shut until they are asked for. */
export const openStatistics = async (page: Page) => {
  const heading = page.locator('aside[aria-label="Inspector"]').getByText("Statistics", { exact: true });
  await expect(heading).toBeVisible();
  if ((await page.locator('aside[aria-label="Inspector"]').getByText("Sum", { exact: true }).count()) === 0) {
    await heading.click();
  }
  await expect(page.locator('aside[aria-label="Inspector"]').getByText("Sum", { exact: true })).toBeVisible();
};

/** A range the way a person makes one: press, drag, release. */
export const dragRange = async (page: Page, from: string, to: string) => {
  const start = await cellAt(page, from);
  const end = await cellAt(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
};

/** What the inspector says is selected. */
export const selected = async (page: Page): Promise<string> => {
  const heading = inspector(page).getByRole("heading", { level: 2 }).first();
  return ((await heading.textContent()) ?? "").trim();
};

export const expressionBox = (page: Page): Locator =>
  page.locator('input[aria-label="Expression"], input[aria-label="Value"]');

export const readBox = (page: Page): Locator =>
  page.locator('button[aria-label="Expression"], button[aria-label="Value"]');

/** Land on one cell, however the selection was left. */
export const focusCell = async (page: Page, address: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Clicking an already selected anchor may open its editor. Cancel before
    // navigating again so this read helper cannot insert a formula reference.
    if ((await expressionBox(page).count()) > 0) await expressionBox(page).first().press("Escape");
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

export const write = async (page: Page, address: string, text: string) => {
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
export const FLUSH_AFTER_MS = 2000;

export const settled = async (page: Page) => {
  await page.waitForTimeout(FLUSH_AFTER_MS + 800);
  await expect(page.locator(".area-strip")).toContainText("Saved", { timeout: 10_000 });
};

export const cellText = async (page: Page, address: string): Promise<string> => {
  await focusCell(page, address);
  if ((await expressionBox(page).count()) > 0) await expressionBox(page).first().press("Escape");
  const box = readBox(page).first();
  await expect(box).toBeVisible();
  const shown = ((await box.textContent()) ?? "").trim();
  return shown === "Empty" ? "" : shown;
};
