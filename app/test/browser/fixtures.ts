import { expect, test as base } from "@playwright/test";

type BrowserFixtures = {
  readonly isolatedRepresentedState: void;
};

/** Every scenario starts from the committed seed and a newly composed server graph. */
const test = base.extend<BrowserFixtures>({
  isolatedRepresentedState: [
    async ({ request }, use) => {
      const token = process.env.ICARUS_BROWSER_RESET_TOKEN;
      if (token !== undefined) {
        const response = await request.post("/demo/browser-harness/reset", {
          headers: { "x-icarus-browser-reset": token }
        });
        expect(response.status(), await response.text()).toBe(204);
      }
      await use();
    },
    { auto: true }
  ]
});

export { expect, test };
export type { Locator, Page, TestInfo } from "@playwright/test";
