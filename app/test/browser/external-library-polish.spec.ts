import { expect, test, type Locator } from "./fixtures";

const readableSize = async (table: Locator) => {
  for (const size of await table.locator(".file-size").all()) {
    expect(await size.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getClientRects().length;
    }), "size and unit stay on one line").toBe(1);
  }
};

test("External Files has a standalone view toggle, author filtering and readable file columns", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.getByRole("toolbar", { name: "Open tabs" }).getByRole("button", { name: "External Files", exact: true }).click();
  await expect(page.getByText(/Native project files live here/)).toHaveCount(0);
  const toggle = page.getByRole("group", { name: "Library view", exact: true });
  const tableChoice = toggle.getByRole("radio", { name: "Table", exact: true });
  await expect(tableChoice).toHaveAttribute("data-state", "on");
  await tableChoice.click();
  await expect(tableChoice).toHaveAttribute("data-state", "on");
  await expect(toggle.getByRole("combobox")).toHaveCount(0);
  expect(await toggle.evaluate((node) => node.closest(".view-switcher") !== null)).toBe(true);

  await page.locator('form.upload-form input[type="file"]').first().setInputFiles([
    { name: "quarterly-report.md", mimeType: "text/markdown", buffer: Buffer.from("# Quarterly report\n".repeat(180)) },
    { name: "analysis.ts", mimeType: "text/typescript", buffer: Buffer.from("export const count = 42;\n") }
  ]);
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  const table = page.getByRole("table");
  const row = table.getByRole("row").filter({ has: page.getByRole("button", { name: "quarterly-report.md", exact: true }) });
  await row.getByRole("button", { name: "quarterly-report.md", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector.locator("dt").filter({ hasText: /^Updated by$/ })).toBeVisible();
  const authorName = await inspector.locator("dt").filter({ hasText: /^Updated by$/ }).evaluate((node) => node.nextElementSibling!.textContent!.trim());
  await expect(table.getByRole("columnheader", { name: "Author", exact: true })).toBeVisible();
  await expect(row.locator(".file-author")).toHaveText(authorName);
  await expect(row.locator(".file-author")).toHaveAttribute("title", `Last updated by ${authorName}`);
  await expect(row.locator(".file-updated")).toHaveText("NOW");

  await inspector.getByRole("button", { name: "Move", exact: true }).click();
  const directory = "research/quarterly-reports/long-origin-name-for-path-disambiguation";
  await inspector.getByLabel("Destination directory; blank means External Files root").fill(directory);
  await inspector.getByRole("region", { name: "File", exact: true }).getByRole("button", { name: "Move", exact: true }).click();
  const path = row.locator(".file-path");
  await expect(path).toHaveAttribute("title", `${directory}/quarterly-report.md`);
  expect(await path.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await readableSize(table);

  const author = page.getByRole("combobox", { name: "Author", exact: true });
  await author.selectOption({ label: authorName });
  const search = page.getByLabel("Search names, paths, or media types");
  await search.fill("quarterly");
  await expect(table.getByRole("button", { name: "analysis.ts", exact: true })).toHaveCount(0);
  await page.getByLabel("File kind", { exact: true }).selectOption("code");
  await expect(page.getByText("No file matches", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear the filter", exact: true }).click();
  await expect(author).toHaveValue("");
  await expect(search).toHaveValue("");
  await expect(table.getByRole("button", { name: "analysis.ts", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("external-files-wide.png"), fullPage: true });

  await toggle.getByRole("radio", { name: "Directory", exact: true }).click();
  await expect(toggle.getByRole("radio", { name: "Directory", exact: true })).toHaveAttribute("data-state", "on");
  await table.getByRole("button", { name: "research", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "external.directory");
  await inspector.getByRole("button", { name: /quarterly-reports/ }).click();
  await expect(inspector).toContainText("long-origin-name-for-path-disambiguation");
  await expect(page.getByRole("navigation", { name: "External Files directory" })).toContainText("External Files");
  await table.getByRole("button", { name: "research", exact: true }).dblclick();
  await table.getByRole("button", { name: "quarterly-reports", exact: true }).dblclick();
  await expect(table.getByRole("button", {
    name: "long-origin-name-for-path-disambiguation", exact: true
  })).toHaveAttribute("title", "long-origin-name-for-path-disambiguation");
  await page.screenshot({ path: info.outputPath("external-files-directory.png"), fullPage: true });

  await tableChoice.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  await expect(toggle).toBeVisible();
  await expect(author).toBeVisible();
  await readableSize(table);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("external-files-compact-zoom.png"), fullPage: true });
  await table.evaluate((node) => {
    const container = node.closest<HTMLElement>('[data-slot="table-container"]')!;
    container.scrollLeft = container.scrollWidth;
  });
  const updatedColumn = table.getByRole("columnheader", { name: "Last updated", exact: true });
  expect(await updatedColumn.evaluate((node) => {
    const cell = node.getBoundingClientRect();
    const container = node.closest('[data-slot="table-container"]')!.getBoundingClientRect();
    return cell.left >= container.left && cell.right <= container.right + 1;
  }), "rightmost columns remain reachable at compact size and 125% zoom").toBe(true);
  await page.screenshot({ path: info.outputPath("external-files-compact-zoom-scrolled.png"), fullPage: true });
  expect(errors).toEqual([]);
});
