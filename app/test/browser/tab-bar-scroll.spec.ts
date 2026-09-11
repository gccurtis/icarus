import { expect, test, type Locator } from "./fixtures";

const scrollLeft = (tabs: Locator) => tabs.evaluate((node) => node.scrollLeft);

const positions = async (buttons: readonly Locator[]) => Promise.all(
  buttons.map((button) => button.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width };
  }))
);

const expectFixed = async (
  buttons: readonly Locator[],
  before: Awaited<ReturnType<typeof positions>>
) => {
  const after = await positions(buttons);
  for (let index = 0; index < buttons.length; index += 1) {
    await expect(buttons[index]).toBeInViewport({ ratio: 1 });
    expect(Math.abs(after[index].x - before[index].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after[index].y - before[index].y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after[index].width - before[index].width)).toBeLessThanOrEqual(1);
  }
};

test("ordinary wheel scrolls transient tabs while permanent tabs stay fixed", async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const toolbar = page.getByRole("toolbar", { name: "Open tabs" });
  const transient = toolbar.locator(".transient-tabs");
  const faces = transient.locator("button.face");
  const newTab = toolbar.locator('button[aria-label="New tab"]');
  const permanent = ["Overview", "Agents", "Templates", "External Files"].map((name) =>
    toolbar.getByRole("button", { name, exact: true })
  );
  const fixed = [...permanent, newTab];

  await permanent[0].click();
  await page.locator(".area-resources").getByRole("button", {
    name: "Winter readiness brief", exact: true
  }).dblclick();
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  const beforeOpening = await faces.count();
  for (let index = 0; index < 20; index += 1) {
    await newTab.click();
    await expect(faces).toHaveCount(beforeOpening + index + 1);
    await expect(faces.last()).toHaveAttribute("aria-current", "page");
    await expect(faces.last()).toBeInViewport({ ratio: 1 });
  }
  expect(await transient.evaluate((node) => node.scrollWidth - node.clientWidth))
    .toBeGreaterThan(500);
  const widePositions = await positions(fixed);
  await toolbar.screenshot({ path: info.outputPath("tabs-wide-newest.png") });

  await transient.hover();
  await page.mouse.wheel(-100_000, 0);
  await expect.poll(() => scrollLeft(transient)).toBeLessThanOrEqual(1);
  await expect(faces.last()).not.toBeInViewport();
  await page.mouse.wheel(0, 140);
  await expect.poll(() => scrollLeft(transient)).toBeGreaterThan(50);
  await expectFixed(fixed, widePositions);
  const afterVertical = await scrollLeft(transient);
  await page.mouse.wheel(120, 0);
  await expect.poll(() => scrollLeft(transient)).toBeGreaterThan(afterVertical + 50);
  await expectFixed(fixed, widePositions);
  await toolbar.screenshot({ path: info.outputPath("tabs-wide-wheel.png") });

  // A cancelable Ctrl+wheel event must reach the browser's zoom default untouched.
  const controlWheel = await transient.evaluate((node) => {
    const before = node.scrollLeft;
    const event = new WheelEvent("wheel", {
      deltaY: 120, ctrlKey: true, bubbles: true, cancelable: true
    });
    node.dispatchEvent(event);
    return { prevented: event.defaultPrevented, before, after: node.scrollLeft };
  });
  expect(controlWheel.prevented).toBe(false);
  expect(controlWheel.after).toBe(controlWheel.before);

  const documentTab = transient.getByRole("button", { name: "Winter readiness brief", exact: true });
  await documentTab.click();
  await expect(documentTab).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  const beforeClosing = await faces.count();
  await transient.getByRole("button", { name: "Close Winter readiness brief", exact: true }).click();
  await expect(documentTab).toHaveCount(0);
  await expect(faces).toHaveCount(beforeClosing - 1);
  await expectFixed(fixed, widePositions);

  // Use the actual tab order to reach buttons initially clipped by the scroller.
  await faces.first().focus();
  await expect(faces.last()).not.toBeInViewport();
  const count = await faces.count();
  for (let index = 0; index < count; index += 1) {
    await expect(faces.nth(index)).toBeFocused();
    await expect(faces.nth(index)).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Tab");
    await expect(transient.locator("button.close").nth(index)).toBeFocused();
    await page.keyboard.press("Tab");
  }
  await expect(newTab).toBeFocused();
  expect(await scrollLeft(transient)).toBeGreaterThan(0);
  await expectFixed(fixed, widePositions);

  await page.setViewportSize({ width: 1000, height: 800 });
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  const compactPositions = await positions(fixed);
  await transient.hover();
  await page.mouse.wheel(-100_000, 0);
  await expect.poll(() => scrollLeft(transient)).toBeLessThanOrEqual(1);
  await page.mouse.wheel(0, 160);
  await expect.poll(() => scrollLeft(transient)).toBeGreaterThan(50);
  await expectFixed(fixed, compactPositions);
  const beforeCompactOpen = await faces.count();
  await newTab.click();
  await expect(faces).toHaveCount(beforeCompactOpen + 1);
  await expect(faces.last()).toHaveAttribute("aria-current", "page");
  await expect(faces.last()).toBeInViewport({ ratio: 1 });
  await expectFixed(fixed, compactPositions);
  await toolbar.screenshot({ path: info.outputPath("tabs-compact-125-percent.png") });
  expect(errors).toEqual([]);
});
