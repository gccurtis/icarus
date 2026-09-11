import { expect, test } from "./fixtures";
import { watchBrowserDiagnostics } from "./browser-diagnostics";
import { checkDocumentAppearance, checkSlideAppearance } from "./templates/visual-checks";
import { createScopedTemplate, tabs, uploadEvidence } from "./templates/external-scope";

test.use({ actionTimeout: 15_000 });

for (const kind of ["document", "presentation"] as const) {
  test(`${kind} template instances read different External files without cross-tab leakage`, async ({ page }, info) => {
    test.skip(process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1" && process.env.ICARUS_LIVE_DERIVED_OUTPUT !== "1", "Requires the deterministic provider or explicitly authorized live providers");
    test.setTimeout(360_000);
    const diagnostics = watchBrowserDiagnostics(page);
    await page.setViewportSize({ width: 1500, height: 950 });
    await page.goto("/app/dev-project", { waitUntil: "networkidle" });
    await uploadEvidence(page);
    const checkAppearance = kind === "document" ? checkDocumentAppearance : checkSlideAppearance;
    const north = await createScopedTemplate(page, kind, "north");
    await checkAppearance(page, north.content, info, `${kind}-north-wide`);
    const south = await createScopedTemplate(page, kind, "south");
    await checkAppearance(page, south.content, info, `${kind}-south-wide`);
    const copies = tabs(page).getByRole("button", { name: north.name, exact: true });
    await expect(copies).toHaveCount(2);
    await copies.first().click();
    await expect(north.output).toContainText(/731\s*MW/);
    await expect(north.output).not.toContainText("842");
    await page.setViewportSize({ width: 1100, height: 760 });
    await checkAppearance(page, north.content, info, `${kind}-north-compact`);
    await copies.last().click();
    await expect(south.output).toContainText(/842\s*MW/);
    await expect(south.output).not.toContainText("731");
    await checkAppearance(page, south.content, info, `${kind}-south-compact`);
    await page.reload({ waitUntil: "networkidle" });
    for (const [index, include, exclude] of [[0, "731", "842"], [1, "842", "731"]] as const) {
      await copies.nth(index).click();
      await expect(south.output).toContainText(new RegExp(`${include}\\s*MW`));
      await expect(south.output).not.toContainText(exclude);
    }
    expect(diagnostics).toEqual([]);
  });
}
