import { expect, test } from "./fixtures";
import { watchBrowserDiagnostics } from "./browser-diagnostics";
import { checkSlideAppearance } from "./templates/visual-checks";

for (const name of ["Board review", "Field team briefing", "Executive update", "Options assessment", "Section divider"]) {
  test(`${name}: template slides remain white and readable across viewport sizes and zooms`, async ({ page }, info) => {
    const diagnostics = watchBrowserDiagnostics(page);
    await page.setViewportSize({ width: 1500, height: 950 });
    await page.goto("/app/dev-project", { waitUntil: "networkidle" });
    const tabs = page.getByRole("toolbar", { name: "Open tabs" });
    await tabs.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByRole("main").getByRole("button", { name, exact: true }).first().click();
    const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
    await inspector.getByRole("button", { name: "Edit template", exact: true }).click();
    await expect(page.locator(".area-title")).toHaveText(`Template · ${name}`);
    const slide = page.locator(".area-canvas").getByRole("application", { name: "Slide" });
    await checkSlideAppearance(page, slide, info, "wide-fit");
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await checkSlideAppearance(page, slide, info, "wide-zoomed-out");
    await page.setViewportSize({ width: 1100, height: 760 });
    await checkSlideAppearance(page, slide, info, "compact");
    expect(diagnostics).toEqual([]);
  });
}
