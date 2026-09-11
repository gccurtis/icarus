import { expect, test, type Locator, type Page } from "./fixtures";
import { watchBrowserDiagnostics } from "./browser-diagnostics";

const openExternalFiles = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: "External Files", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "External Files" })).toBeVisible();
};

const uploadNotes = async (page: Page) => {
  await page.locator('form.upload-form input[type="file"]').first().setInputFiles([
    { name: "launch-notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Launch notes\n\nReady for launch.\n") },
    { name: "review-notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Review notes\n\nReview completed.\n") }
  ]);
  await expect(page.getByRole("table").getByRole("button", {
    name: "launch-notes.md",
    exact: true
  })).toBeVisible();
};

const checkActionLayout = async (inspector: Locator) => {
  const toolbar = inspector.getByRole("toolbar", { name: "File actions" });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Rename", exact: true })).toHaveCount(0);
  const geometry = await inspector.evaluate((node) => {
    const box = (selector: string) => node.querySelector(selector)!.getBoundingClientRect();
    const actions = node.querySelector('[aria-label="File actions"]')!;
    const cells = Array.from(actions.querySelectorAll(":scope > a, :scope > button, :scope > form > button"));
    const rows = cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const toolbarBox = actions.getBoundingClientRect();
    return {
      rows,
      identityBottom: box(".identity").bottom,
      detailsTop: Array.from(node.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Details")!.getBoundingClientRect().top,
      toolbarTop: toolbarBox.top,
      toolbarBottom: toolbarBox.bottom,
      fits: rows.every((row) => row.left >= toolbarBox.left - 1 && row.right <= toolbarBox.right + 1),
      labelsFit: cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1)
    };
  });
  expect(geometry.rows).toHaveLength(4);
  expect(geometry.identityBottom).toBeLessThan(geometry.toolbarTop);
  expect(geometry.toolbarBottom).toBeLessThan(geometry.detailsTop);
  const [download, reupload, move, remove] = geometry.rows;
  expect(Math.abs(download!.top - reupload!.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(move!.top - remove!.top)).toBeLessThanOrEqual(2);
  expect(move!.top).toBeGreaterThanOrEqual(download!.bottom);
  expect(Math.abs(download!.left - move!.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(reupload!.left - remove!.left)).toBeLessThanOrEqual(1);
  expect(Math.max(...geometry.rows.map((row) => row.right - row.left)) -
    Math.min(...geometry.rows.map((row) => row.right - row.left))).toBeLessThanOrEqual(2);
  expect(geometry.fits, "all four actions stay within the inspector").toBe(true);
  expect(geometry.labelsFit, "action labels remain readable at narrow widths").toBe(true);
};

test("External Files history searches recent events and distinguishes empty and no-match states", async ({ page }, info) => {
  const diagnostics = watchBrowserDiagnostics(page);
  await openExternalFiles(page);
  const context = page.getByRole("complementary", { name: "Context" });
  await expect(context.getByText(/Selection belongs to the file Inspector/)).toHaveCount(0);
  await context.getByRole("button", { name: "History", exact: true }).click();
  const search = context.getByRole("searchbox", { name: "Search history" });
  await expect(search).toBeVisible();
  await expect(context.getByRole("status")).toHaveText("No External Files changes yet.");
  await uploadNotes(page);
  const entries = context.locator(".history-list article");
  await expect(entries).toHaveCount(2);
  await search.fill("  LAUNCH-NOTES  ");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Uploaded launch-notes.md");
  await expect(context.getByText("1 of 2", { exact: true })).toBeVisible();
  await search.fill("no-such-event");
  await expect(entries).toHaveCount(0);
  await expect(context.getByRole("status")).toHaveText("No recent events match.");
  await page.screenshot({ path: info.outputPath("history-no-match.png") });
  await search.fill("");
  await expect(entries).toHaveCount(2);
  await expect(context.getByText("2 of 2", { exact: true })).toBeVisible();
  const actorLine = await entries.first().locator("div > span").innerText();
  await search.fill(actorLine.split(" · ").slice(1).join(" · "));
  await expect(entries).toHaveCount(2);
  await search.fill("text/markdown");
  await expect(entries).toHaveCount(2);
  await search.fill("launch-notes");
  await context.getByRole("button", { name: "Overview", exact: true }).click();
  await context.getByRole("button", { name: "History", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(entries).toHaveCount(2);
  await expect(context.getByText(/newest 200 durable/)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("history-search-restored.png") });
  expect(diagnostics).toEqual([]);
});

test("External Files inspector keeps four actions above collapsible details at wide, narrow and zoomed sizes", async ({ page }, info) => {
  const diagnostics = watchBrowserDiagnostics(page);
  await openExternalFiles(page);
  await uploadNotes(page);
  await page.getByRole("table").getByRole("button", { name: "launch-notes.md", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const details = inspector.getByRole("button", { name: "Details", exact: true });
  await expect(details).toBeVisible();
  await checkActionLayout(inspector);
  await expect(inspector.getByRole("button", { name: /^Status (In progress|Ready)$/ })).toBeVisible();
  await expect(inspector.getByText("References", { exact: true })).toBeVisible();
  await details.click();
  await expect(inspector.getByText("References", { exact: true })).toHaveCount(0);
  await details.click();
  await expect(inspector.getByText("References", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("inspector-wide.png") });

  const rename = inspector.getByTitle("Rename file");
  await rename.focus();
  await page.keyboard.press("Enter");
  await inspector.getByRole("textbox", { name: "File name", exact: true }).fill("unsaved-name.md");
  await page.keyboard.press("Escape");
  await expect(rename).toHaveText("launch-notes.md");
  await rename.focus();
  await page.keyboard.press("Space");
  await inspector.getByRole("textbox", { name: "File name", exact: true }).fill("keyboard-renamed.md");
  await page.keyboard.press("Enter");
  await expect(rename).toHaveText("keyboard-renamed.md");

  await page.setViewportSize({ width: 1100, height: 760 });
  await inspector.getByRole("separator", { name: "Resize the inspector" }).press("Home");
  await checkActionLayout(inspector);
  await page.screenshot({ path: info.outputPath("inspector-narrow.png") });
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  await checkActionLayout(inspector);
  await inspector.getByRole("toolbar", { name: "File actions" })
    .getByRole("button", { name: "Move", exact: true }).click();
  await expect(inspector.getByRole("textbox", { name: "Destination directory; blank means External Files root" })).toBeVisible();
  await inspector.getByRole("button", { name: "Cancel move", exact: true }).click();
  await page.screenshot({ path: info.outputPath("inspector-narrow-125-percent.png") });
  expect(diagnostics).toEqual([]);
});
