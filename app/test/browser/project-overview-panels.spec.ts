import { expect, test, type Locator, type Page, type TestInfo } from "./fixtures";

const unexpected: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      unexpected.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      request.url().includes("/__data.json")
    ) return;
    unexpected.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
  });
};

const overflowing = (root: Locator) =>
  root.evaluate((element) => {
    const edge = element.getBoundingClientRect().right;
    return [...element.querySelectorAll("*")]
      .filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.right > edge + 1;
      })
      .map((node) => `${node.tagName}: ${(node.textContent ?? "").trim().slice(0, 80)}`);
  });

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("renders every panel mock beside its data contract", async ({ page }) => {
  await page.goto("/demo/project-overview-panels", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { level: 1, name: "Six flanks, one data contract." })
  ).toBeVisible();

  const panels = [
    ["Overview", "project-overview.overview", 1],
    ["History", "project-overview.history", 2],
    ["Person", "general.person", 3],
    ["Comment", "project-overview.comment", 3],
    ["Activity", "project-overview.activity", 3],
    ["Resource", "project-overview.resource", 3]
  ] as const;

  await expect(page.locator(".panel-nav button")).toHaveCount(panels.length);

  for (const [label, viewKey, sourceCount] of panels) {
    await page.locator(".panel-nav button", { hasText: label }).click();
    await expect(page.getByText(viewKey, { exact: true })).toBeVisible();
    await expect(page.locator(".source-card")).toHaveCount(sourceCount);
    await expect(page.locator(".flank > section")).toBeVisible();
  }
});

test("keeps the reference narrow and the mocks operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/project-overview-panels", { waitUntil: "networkidle" });

  await page.locator(".panel-nav button", { hasText: "History" }).click();
  await page.getByPlaceholder("Search history").fill("substation");
  await expect(page.locator(".flank").getByText("2", { exact: true })).toBeVisible();

  await page.locator(".panel-nav button", { hasText: "Comment" }).click();
  await page.getByLabel("Write a reply").fill("Use dispatch time in the table heading.");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.locator(".flank")).toContainText("Use dispatch time in the table heading.");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
});

test("bounds oversized panel content and makes history rows coherent targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/project-overview-panels", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Long-content stress" }).click();
  const flank = page.locator(".flank");

  for (const label of ["Overview", "History", "Person", "Comment", "Activity", "Resource"]) {
    await page.locator(".panel-nav button", { hasText: label }).click();
    await expect(flank.getByRole("heading", { level: 2 })).toBeVisible();
    expect(await overflowing(flank), `${label} should stay inside the review flank`).toEqual([]);
    if (label === "Activity") {
      await expect(flank.locator("blockquote")).toContainText(
        "How should the resilience team reconcile customer-minutes lost"
      );
      await expect(flank.getByRole("button", { name: "Show more" })).toBeVisible();
    }
  }

  await page.locator(".panel-nav button", { hasText: "History" }).click();
  const longResult = flank.locator("ol button").last();
  const resultBox = await longResult.boundingBox();
  expect(resultBox?.height).toBeLessThanOrEqual(72);
  const idleFill = await longResult.evaluate((element) => getComputedStyle(element).backgroundColor);
  await longResult.hover();
  await expect
    .poll(() => longResult.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(idleFill);

  await page.locator(".panel-nav button", { hasText: "Comment" }).click();
  await expect(flank.getByRole("button", { name: "Show more" })).toHaveCount(3);
  await flank.getByRole("button", { name: "Show more" }).first().click();
  await expect(flank.getByRole("button", { name: "Show less" })).toHaveCount(1);

  await page.locator(".panel-nav button", { hasText: "Resource" }).click();
  const summary = flank.locator('button[title*="Change Summary"]');
  const summaryBox = await summary.boundingBox();
  expect(summaryBox?.height).toBeLessThanOrEqual(96);
  await expect(flank.getByText("Words", { exact: true })).toBeVisible();
  await expect(flank.getByText("Comments", { exact: true })).toBeVisible();
  await expect(flank.getByText("Referenced by", { exact: true })).toHaveCount(0);
});

test("wires the six production panels to scoped project data", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-09T12:00:00.000Z"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  const resources = page.locator(".area-resources");
  if (!(await resources.isVisible())) {
    await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  }
  await expect(resources).toBeVisible();

  const context = page.locator('aside[aria-label="Context"]');
  await context.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(context.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(context.getByText("Status", { exact: true })).toBeVisible();
  await expect(context.getByText("Your role", { exact: true })).toBeVisible();
  await expect(context.getByText("Created", { exact: true })).toBeVisible();
  await expect(context.getByText("Grid Resilience 2027", { exact: true })).toHaveCount(0);
  await expect(context.getByText("Resources", { exact: true })).toHaveCount(0);
  await expect(context.getByText("Needs you", { exact: true })).toHaveCount(0);
  await expect(context.getByRole("button", { name: "Variables", exact: true })).toHaveCount(0);
  await expect(context.getByRole("button", { name: "Context", exact: true })).toHaveCount(0);

  await context.getByRole("button", { name: "History", exact: true }).click();
  await expect(context.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(context.getByText("Addressed to you", { exact: true })).toHaveCount(0);
  await expect(context.getByText(/mentioned you/i)).toHaveCount(0);
  const editedBrief = context.getByRole("button", { name: /Edited: Winter readiness brief/ });
  await expect(editedBrief).toBeVisible();
  await context.getByLabel("History period", { exact: true }).click();
  await page.getByRole("option", { name: "Today", exact: true }).click();
  await expect(editedBrief).toHaveCount(0);
  await context.getByLabel("History period", { exact: true }).click();
  await page.getByRole("option", { name: "All time", exact: true }).click();
  await expect(editedBrief).toBeVisible();
  await context.getByPlaceholder("Search history").fill("substation");
  await expect(
    context.getByRole("heading", { name: "Results", exact: true }).locator("..").getByText("3", { exact: true })
  ).toBeVisible();
  await context.getByPlaceholder("Search history").fill("");

  await context
    .getByRole("button", { name: /Edited: Winter readiness brief/ })
    .click();
  const inspector = page.locator('aside[aria-label="Inspector"]');
  await expect(inspector).toHaveAttribute("data-inspected", "project-overview.activity");
  await expect(inspector.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(inspector.getByText("What", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Where", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Who", { exact: true })).toBeVisible();
  await expect(inspector.getByText("When", { exact: true })).toBeVisible();
  await expect(inspector.getByText(/Sep 1, 2026.*8d ago/)).toBeVisible();
  await expect(inspector.getByText("activity:1", { exact: true })).toHaveCount(0);

  await context
    .getByRole("button", { name: /Started a research question: What is the binding winter constraint/ })
    .click();
  await expect(inspector.locator("blockquote")).toContainText("What is the binding winter constraint?");
  await expect(inspector.getByText("Research chat", { exact: true })).toBeVisible();

  await resources
    .getByRole("button", { name: "Winter readiness brief", exact: true })
    .click();
  await expect(inspector).toHaveAttribute("data-inspected", "project-overview.resource");
  await expect(
    inspector.getByRole("heading", { name: "Winter readiness brief", exact: true })
  ).toBeVisible();
  await expect(inspector.getByText("Summary", { exact: true })).toBeVisible();
  await expect(inspector.getByText("At a glance", { exact: true })).toBeVisible();
  await expect(inspector).toContainText("Executive view of the grid's highest winter reliability exposures");
  await expect(inspector.getByText("Template", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText("Resource ID", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText("Words", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Comments", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Referenced by", { exact: true })).toHaveCount(0);

  const inspectorResize = page.getByRole("separator", { name: "Resize the inspector" });
  await inspectorResize.focus();
  await inspectorResize.press("Home");
  expect(await overflowing(inspector), "resource should fit the minimum inspector width").toEqual([]);
  await inspectorResize.press("End");
  expect(await overflowing(inspector), "resource should fit the maximum inspector width").toEqual([]);

  await inspector.getByRole("button", { name: "Mira Okonkwo", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspected", "general.person");
  await expect(inspector.getByRole("heading", { name: "Mira Okonkwo", exact: true })).toBeVisible();
  await expect(inspector.getByText("mira@example.org", { exact: true })).toBeVisible();

  const review = page.locator(".area-review");
  await review.getByRole("button").filter({ hasText: "mentioned you" }).first().click();
  await expect(inspector).toHaveAttribute("data-inspected", "project-overview.comment");
  await expect(inspector.getByRole("heading", { name: "Comment", exact: true })).toBeVisible();
  await expect(inspector.getByText("Open", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Document", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Substation 14 incident write-up", { exact: true })).toBeVisible();
  await expect(inspector).toContainText("restore or the dispatch");
  await expect(inspector.getByText("Replies (1)", { exact: true })).toBeVisible();
  await expect(inspector.getByText(/remarks|updated Aug/i)).toHaveCount(0);
  await inspectorResize.focus();
  await inspectorResize.press("Home");
  expect(await overflowing(inspector), "comment should fit the minimum inspector width").toEqual([]);
  await inspectorResize.press("End");
  expect(await overflowing(inspector), "comment should fit the maximum inspector width").toEqual([]);
  await page.waitForLoadState("networkidle");
});
