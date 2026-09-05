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
  await page.getByRole("button", { name: "Winter readiness brief", exact: true }).dblclick();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toContainText("Winter readiness brief");
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

test("the fixture can be reached with the keyboard", async ({ page }) => {
  await page.setViewportSize(viewports.default);
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  const fixture = page.getByRole("button", { name: "Winter readiness brief", exact: true });
  await fixture.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator(".ProseMirror")).toBeVisible();
});
