import { expect, test } from "./fixtures";

test("workspace names and compact History controls match their surfaces", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  const externalFiles = tabs.getByRole("button", { name: "External Files", exact: true });
  await expect(externalFiles).toHaveAttribute("title", "External Files");
  await externalFiles.click();
  await expect(externalFiles).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "External Files", exact: true }))
    .toBeVisible();

  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".area-resources")).toBeVisible();
  const context = page.getByRole("complementary", { name: "Context", exact: true });
  await context.getByRole("button", { name: "History", exact: true }).click();
  const period = context.getByLabel("History period", { exact: true });
  await expect(period).toHaveText("All time");
  await expect(context.getByText("Filter", { exact: true })).toHaveCount(0);
  await period.click();
  await page.getByRole("option", { name: "Past 7 days", exact: true }).click();
  await expect(period).toHaveText("Past 7 days");

  const contextResize = page.getByRole("separator", { name: "Resize the context panel", exact: true });
  await contextResize.focus();
  await contextResize.press("Home");
  const contextBox = await context.boundingBox();
  const periodBox = await period.boundingBox();
  expect(contextBox).not.toBeNull();
  expect(periodBox).not.toBeNull();
  expect(periodBox!.x).toBeGreaterThanOrEqual(contextBox!.x);
  expect(periodBox!.x + periodBox!.width).toBeLessThanOrEqual(contextBox!.x + contextBox!.width);
  await page.screenshot({ path: info.outputPath("overview-history-dropdown.png") });

  await tabs.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agents", exact: true })).toBeVisible();
  await page.locator(".area-create").getByRole("button", { name: "Persona", exact: true }).click();
  const main = page.getByRole("main");
  await expect(main.getByLabel("Persona name")).toHaveValue("Untitled persona");
  const scopeGroup = main.locator(".pair > section").nth(1);
  await expect(scopeGroup.locator(":scope > div > span").first()).toHaveText("Scope");
  await expect(scopeGroup.getByRole("tab", { name: "Scope", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await scopeGroup.getByRole("tab", { name: "Tools", exact: true }).click();
  await expect(scopeGroup.getByRole("tab", { name: "Tools", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await scopeGroup.getByRole("tab", { name: "Scope", exact: true }).click();
  await expect(scopeGroup.getByRole("button", { name: "Add resource", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("persona-scope.png") });
  expect(errors).toEqual([]);
});
