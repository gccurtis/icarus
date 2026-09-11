import { expect, type Locator, type Page, type TestInfo } from "../fixtures";

/** Check the rendered slide, not merely the seed or the CSS variable's spelling. */
export const checkSlideAppearance = async (page: Page, slide: Locator, info: TestInfo, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await expect(slide).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(slide.locator("[data-item]").first()).toBeVisible();
  const failures = await slide.evaluate((node) => {
    const errors: string[] = [];
    const paper = node.getBoundingClientRect();
    const contains = (outer: DOMRect, inner: DOMRect) =>
      inner.left >= outer.left - 2 && inner.right <= outer.right + 2 &&
      inner.top >= outer.top - 2 && inner.bottom <= outer.bottom + 2;
    for (const item of node.querySelectorAll<HTMLElement>("[data-item]")) {
      const box = item.getBoundingClientRect();
      const id = item.dataset.item;
      if (!contains(paper, box)) errors.push(`${id}: element outside the slide`);
      for (const text of item.querySelectorAll<HTMLElement>(".text")) {
        const paint = getComputedStyle(text);
        if (paint.color === "rgba(0, 0, 0, 0)" || paint.color === "rgb(255, 255, 255)") errors.push(`${id}: unreadable text color`);
        if ((paint.overflowY !== "visible" && text.scrollHeight > text.clientHeight + 2) ||
          (paint.overflowX !== "visible" && text.scrollWidth > text.clientWidth + 2)) errors.push(`${id}: text clipped by its box`);
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const glyphs of range.getClientRects()) {
          if (glyphs.width > 0 && !contains(box, glyphs)) errors.push(`${id}: rendered text outside its element`);
          for (let parent = text.parentElement; parent !== null && parent !== item; parent = parent.parentElement) {
            const clipping = getComputedStyle(parent);
            if ([clipping.overflowX, clipping.overflowY].includes("hidden") && glyphs.width > 0 && !contains(parent.getBoundingClientRect(), glyphs)) {
              errors.push(`${id}: rendered text clipped by a container`);
            }
          }
        }
      }
    }
    return errors;
  });
  expect(failures, `${name}: rendered layout defects`).toEqual([]);
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
};

export const checkDocumentAppearance = async (page: Page, editor: Locator, info: TestInfo, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await expect(editor).toBeVisible();
  const colors = await editor.evaluate((node) => {
    const candidates = [node, ...node.querySelectorAll(".document-page, .page")];
    return candidates.map((page) => getComputedStyle(page).backgroundColor);
  });
  expect(colors, "the authored page is white").toContain("rgb(255, 255, 255)");
  const generated = editor.locator('.document-block[data-kind="prompt"]').last();
  await expect(generated).toBeVisible();
  expect(await generated.evaluate((node) => node.scrollWidth <= node.clientWidth + 2), "prompt text must not overflow horizontally").toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
};
