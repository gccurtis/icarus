import { expect, test, type Page, type TestInfo } from "./fixtures";

const diagnostics: string[] = [];

const watchDiagnostics = (page: Page): void => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      diagnostics.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) {
      return;
    }
    diagnostics.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.push(`http:${response.status()}: ${response.url()}`);
  });
};

const openResearch = async (page: Page, title: string): Promise<void> => {
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const resources = page.locator(".area-resources");
  await resources.getByPlaceholder("Search this project").fill(title);
  await resources.getByRole("button", { name: title, exact: true }).dblclick();
  await expect(
    page.getByRole("toolbar", { name: "Open tabs" }).getByRole("button", {
      name: title,
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  diagnostics.length = 0;
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({ request }, testInfo: TestInfo) => {
  const providerOrigin = process.env.ICARUS_BROWSER_PROVIDER_ORIGIN;
  if (providerOrigin !== undefined) {
    const released = await request.post(`${providerOrigin}/control/release`);
    expect(released.ok(), await released.text()).toBe(true);
  }
  expect(diagnostics, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("a finished research answer survives tab switching and reload", async ({ page }) => {
  const title = "What is the binding winter constraint?";
  await openResearch(page, title);

  await expect(page.locator("main")).toContainText("Why do the two feeder alternatives not remove that exposure?");
  await expect(page.locator("main")).toContainText("Both feeders run through the same corridor");
  await expect(page.locator("main")).not.toContainText("That question did not finish");

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".area-resources")).toBeVisible();
  await tabs.getByRole("button", { name: title, exact: true }).click();
  await expect(page.locator("main")).toContainText("Both feeders run through the same corridor");

  await page.reload({ waitUntil: "networkidle" });
  const reloadedTab = page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: title, exact: true });
  await expect(reloadedTab).toBeVisible();
  await reloadedTab.click();
  await expect(page.locator("main")).toContainText("Both feeders run through the same corridor");
});

test("a failed research turn remains inspectable without trapping the tab", async ({ page }) => {
  const title = "Is a NERC winter review in the project?";
  await openResearch(page, title);

  await expect(page.locator("main")).toContainText("Then cite page 31 anyway.");
  await expect(page.getByText("That question did not finish", { exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "The provider stopped before it returned a finished answer."
  );

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  await tabs.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByText("That question did not finish", { exact: true })).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: title, exact: true })
    .click();
  await expect(page.getByText("That question did not finish", { exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "The provider stopped before it returned a finished answer."
  );
});

test("an unsent research draft belongs to its chat across a tab switch", async ({ page }) => {
  const title = "What is the binding winter constraint?";
  const draft = "Compare that ranking with the capital plan.";
  await openResearch(page, title);

  const composer = page.getByRole("textbox", { name: "Message" });
  await composer.fill(draft);
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  await tabs.getByRole("button", { name: title, exact: true }).click();

  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(draft);
});

test("a project-wide arithmetic question completes as insufficient instead of failing ingestion", async ({
  page,
  request
}) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);
  const providerOrigin = process.env.ICARUS_BROWSER_PROVIDER_ORIGIN;
  expect(providerOrigin).toBeDefined();
  const beforeResponse = await request.get(`${providerOrigin}/state`);
  expect(beforeResponse.ok()).toBe(true);
  const before = (await beforeResponse.json()) as {
    calls: { jina: number; openrouter: number };
  };

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.locator(".area-create").getByRole("button", { name: "Research chat" }).click();
  const question = "If you have five apples and take two away, how many are left?";
  await page.getByRole("textbox", { name: "Message" }).fill(question);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.locator("main")).toContainText(question);
  await expect(page.locator("main .answer .said")).toContainText(
    "Nothing in this project answers that",
    { timeout: 150_000 }
  );
  await expect(page.locator("main")).not.toContainText("That question did not finish");
  const afterResponse = await request.get(`${providerOrigin}/state`);
  expect(afterResponse.ok()).toBe(true);
  const after = (await afterResponse.json()) as {
    calls: { jina: number; openrouter: number };
  };
  expect(after.calls.jina).toBeGreaterThan(before.calls.jina);
  expect(after.calls.openrouter).toBeGreaterThan(before.calls.openrouter);
});

test("a deterministic provider answers from the default project-wide scope", async ({
  page
}) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.locator(".area-create").getByRole("button", { name: "Research chat" }).click();
  const question = "Which substation is the binding winter constraint?";
  await page.getByRole("textbox", { name: "Message" }).fill(question);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.locator("main .answer .said")).toHaveText(
    "The readiness brief identifies Substation 14 as the binding constraint.",
    { timeout: 150_000 }
  );
  await expect(page.locator("main")).not.toContainText("That question did not finish");
  await expect(page.locator("main")).not.toContainText("Nothing in this project answers that");
});

test("a deterministic provider completes a real research turn across a tab switch and reload", async ({
  page,
  request
}) => {
  test.skip(
    process.env.ICARUS_BROWSER_PROVIDER_FIXTURE !== "1",
    "The caller-owned server did not opt into the deterministic browser provider"
  );
  test.setTimeout(180_000);
  const providerOrigin = process.env.ICARUS_BROWSER_PROVIDER_ORIGIN;
  expect(providerOrigin).toBeDefined();

  const beforeResponse = await request.get(`${providerOrigin}/state`);
  expect(beforeResponse.ok()).toBe(true);
  const before = (await beforeResponse.json()) as {
    calls: { jina: number; openrouter: number };
  };
  const held = await request.post(`${providerOrigin}/control/hold`);
  expect(held.ok(), await held.text()).toBe(true);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.locator(".area-create").getByRole("button", { name: "Research chat" }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  await page.getByRole("button", { name: "Context" }).click();
  await page.getByRole("option", { name: "Winter readiness brief", exact: true }).click();

  const question = "Which substation is the binding winter constraint?";
  const answer = "The readiness brief identifies Substation 14 as the binding constraint.";
  await page.getByRole("textbox", { name: "Message" }).fill(question);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("main")).toContainText(question);
  await expect(page.locator("main")).toContainText("Reading the project");

  await expect
    .poll(
      async () => {
        const response = await request.get(`${providerOrigin}/state`);
        expect(response.ok()).toBe(true);
        const state = (await response.json()) as { barrier: { waiting: number } };
        return state.barrier.waiting;
      },
      { timeout: 150_000 }
    )
    .toBe(1);

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".area-resources")).toBeVisible();
  await tabs.getByRole("button", { name: "New chat", exact: true }).click();

  await expect(page.locator("main")).toContainText(question);
  await expect(page.locator("main")).toContainText("Reading the project");
  await expect(page.locator("main")).not.toContainText("Nothing asked yet");

  const released = await request.post(`${providerOrigin}/control/release`);
  expect(released.ok(), await released.text()).toBe(true);

  await expect(page.locator("main .answer .said")).toHaveText(answer, { timeout: 150_000 });
  await expect(page.locator("main")).not.toContainText("Reading the project");
  await expect(page.locator("main")).not.toContainText("That question did not finish");
  await expect(page.locator(".zone.inspector")).toContainText("Winter readiness brief");
  await expect(tabs.getByRole("button", { name: question, exact: true })).toBeVisible();

  const afterResponse = await request.get(`${providerOrigin}/state`);
  expect(afterResponse.ok()).toBe(true);
  const after = (await afterResponse.json()) as {
    calls: { jina: number; openrouter: number };
  };
  expect(after.calls.jina).toBeGreaterThan(before.calls.jina);
  expect(after.calls.openrouter).toBeGreaterThan(before.calls.openrouter);

  await page.reload({ waitUntil: "networkidle" });
  const reloadedTab = page
    .getByRole("toolbar", { name: "Open tabs" })
    .getByRole("button", { name: question, exact: true });
  await expect(reloadedTab).toBeVisible();
  await reloadedTab.click();
  await expect(page.locator("main")).toContainText(question);
  await expect(page.locator("main .answer .said")).toHaveText(answer);
  await expect(page.locator(".zone.inspector")).toContainText("Winter readiness brief");
});

test("a live research question completes across a tab switch and reload", async ({ page }) => {
  test.skip(
    process.env.ICARUS_LIVE_RESEARCH_CHAT !== "1",
    "Set ICARUS_LIVE_RESEARCH_CHAT=1 to spend real embedding and intelligence calls"
  );
  test.setTimeout(720_000);

  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  await page.locator(".area-create").getByRole("button", { name: "Research chat" }).click();
  const question = "What does the project recommend for transformer bank replacement?";
  await page.getByRole("textbox", { name: "Message" }).fill(question);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("main")).toContainText(question);
  await expect(page.locator("main")).toContainText("Reading the project");

  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  await tabs.getByRole("button", { name: "New chat", exact: true }).click();

  await expect(page.locator("main .answer .said").first()).toBeVisible({ timeout: 600_000 });
  await expect(page.locator("main")).not.toContainText("That question did not finish");
  await expect(page.locator("main")).not.toContainText("Reading the project");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("main")).toContainText(question);
  await expect(page.locator("main .answer .said").first()).toBeVisible();
});
