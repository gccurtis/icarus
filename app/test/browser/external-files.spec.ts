import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { expect, test, type Page, type TestInfo } from "./fixtures";

let unexpected: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      unexpected.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) return;
    unexpected.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
  });
};

test.beforeEach(async ({ page }) => {
  unexpected = [];
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

const openExternal = async (page: Page) => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  const externalTab = tabs.getByRole("button", { name: "External", exact: true });
  await expect(externalTab).toBeVisible();
  await externalTab.click();
  await expect(externalTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "External" })).toBeVisible();
  await expect(page.getByText("External never opens a file-type editor")).toBeVisible();
  return tabs;
};

test("External manages rename, move, re-upload, download, History, and deletion on one stable file identity", async ({ page }) => {
  const tabs = await openExternal(page);
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const table = page.getByRole("table");

  await page.locator('form.upload-form input[type="file"]').first().setInputFiles({
    name: "live-code.ts",
    mimeType: "text/typescript",
    buffer: Buffer.from("export const version = 1;\n")
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();

  await expect(page.getByText("1 uploaded · 0 already present · 0 rejected.")).toBeVisible();
  await expect(table.getByRole("button", { name: "live-code.ts", exact: true })).toBeVisible();
  await expect(inspector.getByText("code", { exact: true })).toBeVisible();
  await expect(tabs.getByRole("button", { name: /live-code\.ts/ })).toHaveCount(0);

  const firstHref = await inspector.getByRole("link", { name: "Download", exact: true }).getAttribute("href");
  expect(firstHref).not.toBeNull();

  await inspector.getByTitle("Double-click to rename").dblclick();
  await inspector.getByLabel("File name").fill("managed-code.ts");
  await inspector.getByRole("button", { name: "Save", exact: true }).click();
  await expect(table.getByRole("button", { name: "managed-code.ts", exact: true })).toBeVisible();
  await expect(inspector.getByText("live-code.ts", { exact: true })).toBeVisible();

  await inspector.getByRole("button", { name: "Move", exact: true }).first().click();
  await inspector.getByLabel("Destination directory; blank means External root").fill("validation");
  await inspector.getByRole("button", { name: "Move", exact: true }).last().click();
  await expect(inspector.getByText("validation/managed-code.ts", { exact: true })).toBeVisible();

  await inspector.locator('form.reupload-form input[type="file"]').setInputFiles({
    name: "replacement.ts",
    mimeType: "text/typescript",
    buffer: Buffer.from("export const version = 2;\n")
  });
  await expect(inspector.getByText(/Re-uploaded .* revision/)).toBeVisible();
  const secondHref = await inspector.getByRole("link", { name: "Download", exact: true }).getAttribute("href");
  expect(secondHref).toBe(firstHref);
  const response = await page.request.get(secondHref!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["etag"]).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  expect(await response.text()).toBe("export const version = 2;\n");

  await page.getByRole("button", { name: "History", exact: true }).click();
  const context = page.getByRole("complementary", { name: "Context" });
  await expect(context.getByText(/Re-uploaded managed-code\.ts/)).toBeVisible();
  await expect(context.getByText(/Moved managed-code\.ts/)).toBeVisible();
  await expect(context.getByText(/Renamed managed-code\.ts/)).toBeVisible();

  await inspector.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Delete managed-code.ts from this project?" })).toBeVisible();
  await inspector.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(table.getByRole("button", { name: "managed-code.ts", exact: true })).toHaveCount(0);
  await expect(context.getByText(/Deleted managed-code\.ts/)).toBeVisible();
});

test("External library keeps prose, code, data, and signed binary behavior distinct", async ({ page }) => {
  await openExternal(page);
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const table = page.getByRole("table");
  const picker = page.locator('form.upload-form input[type="file"]').first();

  await picker.setInputFiles([
    {
      name: "metrics.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("region,revenue\nNorth,120\nSouth,95\n")
    },
    {
      name: "brief.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Launch brief\n\nThe target date is October 12.\n")
    },
    {
      name: "worker.ts",
      mimeType: "text/typescript",
      buffer: Buffer.from("export const run = () => 'ready';\n")
    },
    {
      name: "misleading.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("%PDF-1.7\nnot actually markdown\n")
    }
  ]);
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("4 uploaded · 0 already present · 0 rejected.")).toBeVisible();

  await page.getByLabel("Search names, paths, or media types").fill("metrics");
  await expect(table.getByRole("button", { name: "metrics.csv", exact: true })).toBeVisible();
  await expect(table.getByRole("button", { name: "brief.md", exact: true })).toHaveCount(0);
  await page.getByLabel("Search names, paths, or media types").fill("");

  await page.getByLabel("File kind").selectOption("text");
  await expect(table.getByRole("button", { name: "brief.md", exact: true })).toBeVisible();
  await expect(table.getByRole("button", { name: "worker.ts", exact: true })).toHaveCount(0);
  await page.getByLabel("File kind").selectOption("all");

  await table.getByRole("button", { name: "brief.md", exact: true }).click();
  await expect(inspector.getByText("text", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("heading", { name: "Exact text lane" })).toBeVisible();
  await expect(inspector.getByRole("heading", { name: "Generated description" })).toHaveCount(0);

  await table.getByRole("button", { name: "worker.ts", exact: true }).click();
  await expect(inspector.getByText("code", { exact: true })).toBeVisible();

  await table.getByRole("button", { name: "metrics.csv", exact: true }).click();
  await expect(inspector.getByText("data", { exact: true })).toBeVisible();
  await inspector.getByPlaceholder("What does this dataset represent?").fill(
    "Regional revenue in USD from the validated quarterly finance export."
  );
  await inspector.getByRole("button", { name: "Save context", exact: true }).click();
  await expect(inspector.getByText("Dataset context saved and semantic processing queued.")).toBeVisible();

  await picker.setInputFiles({
    name: "metrics.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("region,revenue\nNorth,999\n")
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await expect(page.getByText("0 uploaded · 0 already present · 1 rejected.")).toBeVisible();
  await expect(page.getByText(/use Re-upload to replace its contents/i)).toBeVisible();

  await table.getByRole("button", { name: "misleading.md", exact: true }).click();
  await expect(inspector.getByText("application/pdf", { exact: true })).toBeVisible();
  await expect(inspector.getByText("unknown", { exact: true })).toBeVisible();
  await expect(inspector.getByText(/not currently admitted to a semantic lane/i)).toBeVisible();

  await page.getByRole("button", { name: "Order", exact: true }).click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  const names = await table.locator("tbody tr td:first-child button span").allTextContents();
  expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
  await page.getByRole("button", { name: "Reverse order" }).click();
  const reversed = await table.locator("tbody tr td:first-child button span").allTextContents();
  expect(reversed).toEqual([...names].reverse());
});

const filesBelow = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat().sort();
};

test("directory ingestion handles the real External source tree plus a substantial payload and survives reload", async ({ page }) => {
  test.setTimeout(120_000);
  await openExternal(page);
  const sourceRoot = join(process.cwd(), "src/lib/capabilities/external-files");
  const temporary = await mkdtemp(join(tmpdir(), "icarus-external-browser-scale-"));
  const uploadRoot = join(temporary, "external-source");
  await cp(sourceRoot, uploadRoot, { recursive: true });
  const largePath = join(uploadRoot, "large-payload.bin");
  const largeSize = 8 * 1024 * 1024;
  await writeFile(largePath, Buffer.alloc(largeSize, 0x5a));
  const paths = await filesBelow(uploadRoot);
  const relativePaths = paths.map((path) =>
    `external-source/${relative(uploadRoot, path).replaceAll("\\", "/")}`
  );

  try {
    const folderInput = page.locator('form.upload-form input[type="file"]').nth(1);
    await folderInput.evaluate((node) => node.removeAttribute("webkitdirectory"));
    await folderInput.setInputFiles(paths);
    await folderInput.evaluate((node, names) => {
      Array.from((node as HTMLInputElement).files ?? []).forEach((file, index) => {
        Object.defineProperty(file, "webkitRelativePath", { configurable: true, value: names[index] });
      });
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.setAttribute("webkitdirectory", "");
    }, relativePaths);
    await page.getByRole("button", { name: "Upload folder", exact: true }).click();
    await expect(page.getByText(`${paths.length} uploaded · 0 already present · 0 rejected.`)).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Directory", exact: true }).click();
    const rootTable = page.getByRole("table");
    await expect(rootTable.getByRole("button", { name: "external-source", exact: true })).toBeVisible();
    await rootTable.getByRole("button", { name: "external-source", exact: true }).click();
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    await expect(inspector.getByText(`${paths.length}`, { exact: true }).first()).toBeVisible();

    await inspector.getByRole("button", { name: "Rename", exact: true }).last().click();
    await inspector.getByLabel("Directory name").fill("external-source-verified");
    await inspector.getByRole("button", { name: "Rename", exact: true }).last().click();
    await expect(rootTable.getByRole("button", { name: "external-source-verified", exact: true })).toBeVisible({ timeout: 60_000 });

    await inspector.getByRole("button", { name: "Move", exact: true }).first().click();
    await inspector.getByLabel("Directory path").fill("archive/external-source-verified");
    await inspector.getByRole("button", { name: "Move", exact: true }).last().click();
    await expect(rootTable.getByRole("button", { name: "archive", exact: true })).toBeVisible({ timeout: 60_000 });

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "External" })).toBeVisible();
    await page.getByRole("button", { name: "Directory", exact: true }).click();
    const reloaded = page.getByRole("table");
    await reloaded.getByRole("button", { name: "archive", exact: true }).dblclick();
    await reloaded.getByRole("button", { name: "external-source-verified", exact: true }).dblclick();
    const breadcrumbs = page.getByRole("navigation", { name: "External directory" });
    await expect(breadcrumbs).toContainText("archive");
    await expect(breadcrumbs).toContainText("external-source-verified");
    await reloaded.getByRole("button", { name: "large-payload.bin", exact: true }).click();
    const download = page.getByRole("complementary", { name: "Inspector" }).getByRole("link", { name: "Download", exact: true });
    const href = await download.getAttribute("href");
    expect(href).not.toBeNull();
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBe(largeSize);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
