import { expect, test } from "./fixtures";
import { watchBrowserDiagnostics } from "./browser-diagnostics";
import { atFullSize, cellText, clickCell, dragRange, expressionBox, focusCell, inspector, openSheet, openStatistics, readBox, selected, settled, surface, write } from "./spreadsheet/driver";

let diagnostics: string[];
test.beforeEach(async ({ page }) => {
  diagnostics = watchBrowserDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSheet(page);
  await atFullSize(page);
});
test.afterEach(() => expect(diagnostics).toEqual([]));

test("typing fills the original range, not the cell clicked afterward, and survives reload", async ({ page }) => {
  await dragRange(page, "E22", "F23");
  await expect.poll(() => selected(page)).toBe("E22:F23");
  await page.keyboard.type("Range entry");
  await expect(expressionBox(page)).toHaveValue("Range entry");
  await clickCell(page, "H25");
  await expect.poll(() => selected(page)).toBe("H25");
  expect(await cellText(page, "H25")).toBe("");
  for (const cell of ["E22", "F22", "E23", "F23"]) expect(await cellText(page, cell)).toBe("Range entry");
  await settled(page);
  await page.reload({ waitUntil: "networkidle" });
  await expect(surface(page)).toBeVisible();
  await atFullSize(page);
  for (const cell of ["E22", "F22", "E23", "F23"]) expect(await cellText(page, cell)).toBe("Range entry");
  expect(await cellText(page, "H25")).toBe("");
});

test("reverse and separate ranges keep their anchor, fill together, and undo together", async ({ page }) => {
  await write(page, "F23", "Original anchor");
  await dragRange(page, "F23", "E22");
  await expect(readBox(page)).toHaveText("Original anchor");
  await clickCell(page, "H25", ["Control"]);
  await page.keyboard.type("42");
  await expect(expressionBox(page)).toHaveValue("42");
  await expressionBox(page).press("Enter");
  for (const cell of ["E22", "F22", "E23", "F23", "H25"]) expect(await cellText(page, cell)).toBe("42");
  expect(await cellText(page, "G24")).toBe("");
  await page.keyboard.press("Control+z");
  expect(await cellText(page, "F23")).toBe("Original anchor");
  for (const cell of ["E22", "F22", "E23", "H25"]) expect(await cellText(page, cell)).toBe("");
});

test("an expression fills every selected cell and all its answers follow their source", async ({ page }) => {
  await write(page, "H25", "7");
  await dragRange(page, "E22", "F23");
  await page.keyboard.type("=$H$25");
  await expressionBox(page).press("Enter");
  await openStatistics(page);
  await expect(inspector(page).getByText("28", { exact: true }).first()).toBeVisible();
  await write(page, "H25", "10");
  await dragRange(page, "E22", "F23");
  await openStatistics(page);
  await expect(inspector(page).getByText("40", { exact: true }).first()).toBeVisible();
  await settled(page);
  await page.reload({ waitUntil: "networkidle" });
  await expect(surface(page)).toBeVisible();
  await atFullSize(page);
  for (const cell of ["E22", "F22", "E23", "F23"]) expect(await cellText(page, cell)).toBe("=$H$25");
  expect(await cellText(page, "H25")).toBe("10");
});

test("Escape cancels the whole range without leaving keystrokes for a later selection", async ({ page }) => {
  await dragRange(page, "E22", "F23");
  await page.keyboard.type("Cancel this");
  await expect(expressionBox(page)).toHaveValue("Cancel this");
  await expressionBox(page).press("Escape");
  await clickCell(page, "H25");
  for (const cell of ["E22", "F22", "E23", "F23", "H25"]) expect(await cellText(page, cell)).toBe("");
});

test("the four reference locks cover both ends of a dragged range", async ({ page }, testInfo) => {
  await focusCell(page, "H25");
  await page.keyboard.type("=SUM(");
  await expect(expressionBox(page)).toHaveValue("=SUM(");
  await dragRange(page, "E22", "F23");
  const field = expressionBox(page);
  await expect(field).toHaveValue("=SUM(E22:F23");
  const locks = inspector(page).getByRole("group", { name: "What copying holds still" });
  for (const label of ["E22:F23", "$E$22:$F$23", "E$22:F$23", "$E22:$F23"]) {
    await expect(locks.getByRole("button", { name: label, exact: true })).toBeVisible();
    await locks.getByRole("button", { name: label, exact: true }).click();
    await expect(field).toHaveValue(`=SUM(${label}`);
    await expect(locks.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await field.press("F4");
  await expect(field).toHaveValue("=SUM(E22:F23");
  await field.press("F4");
  await expect(field).toHaveValue("=SUM($E$22:$F$23");
  expect(await locks.evaluate((node) => {
    const panel = node.closest('aside[aria-label="Inspector"]')!.getBoundingClientRect();
    return [...node.querySelectorAll("button")].every((button) => {
      const box = button.getBoundingClientRect();
      return box.left >= panel.left && box.right <= panel.right && button.scrollWidth <= button.clientWidth + 1;
    });
  }), "all four range labels fit within the inspector").toBe(true);
  await page.screenshot({ path: testInfo.outputPath("range-reference-locks.png") });
  await field.type(")");
  await field.press("Enter");
  await settled(page);
  await page.reload({ waitUntil: "networkidle" });
  await expect(surface(page)).toBeVisible();
  await atFullSize(page);
  expect(await cellText(page, "H25")).toBe("=SUM($E$22:$F$23)");
  await readBox(page).click();
  await expressionBox(page).press("Control+a");
  await dragRange(page, "E22", "F23");
  await expect(expressionBox(page)).toHaveValue("=E22:F23");
  await expressionBox(page).press("Escape");
  expect(await cellText(page, "H25")).toBe("=SUM($E$22:$F$23)");
});
