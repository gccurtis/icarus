import { expect, test } from "./fixtures";

test("publishes the complete editor audit without layout overflow or diagnostics", async ({ page }) => {
  const diagnostics: string[] = [];
  page.on("pageerror", (error) => diagnostics.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/editor-audit", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Editor audit", exact: true })).toBeVisible();
  await expect(page.locator("details.finding")).toHaveCount(35);
  await expect(page.locator(".metric-fixed strong")).toHaveText("35");
  await expect(page.locator(".metric-urgent strong")).toHaveText("0");
  await expect(page.getByText("16/16", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decisions recorded" })).toBeVisible();
  await expect(page.getByText("5 of 5 decisions recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Require one contiguous selection. A disjoint Control/Command multi-selection may still be formatted, but it cannot start a comment thread.",
      { exact: true }
    )
  ).toBeAttached();
  await expect(page.getByText("Next letter hid comments and links under the caret")).toBeVisible();
  await expect(page.getByText("Template color tokens were emitted as invalid CSS")).toBeVisible();
  await expect(page.getByText("Runtime JSON writes reloaded the localhost workspace")).toBeVisible();
  await expect(page.getByText("Document line height mixed pixels with unitless ratios")).toBeVisible();
  await expect(page.getByText("Distribute was not idempotent for overlapping objects")).toBeVisible();

  const delegation = page.getByRole("textbox", {
    name: /For the remaining editor decisions, where should I proceed autonomously/
  });
  await expect(page.getByText("Responses save automatically in this browser.", { exact: true })).toBeVisible();
  await delegation.fill("Delegate with guardrails. Stop only at the documented boundaries.");
  await expect(page.getByText("5 of 5 decisions recorded", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(delegation).toHaveValue(
    "Delegate with guardrails. Stop only at the documented boundaries."
  );

  const widths = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  expect(diagnostics).toEqual([]);
});
