import { expect, test, type Page, type TestInfo } from "./fixtures";

const unexpected: string[] = [];

const watchDiagnostics = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      unexpected.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) {
      return;
    }
    unexpected.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
  });
};

const restoreDocumentFixture = async (page: Page) => {
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.getByRole("button", { name: "Overview", exact: true }).click();
  const resources = page.locator(".area-resources");
  await resources.getByPlaceholder("Search this project").fill("Winter readiness brief");
  await resources
    .getByRole("button", { name: "Winter readiness brief", exact: true })
    .dblclick();
  await expect(page.locator(".title-bar h1")).toHaveText("Winter readiness brief");
  await page.waitForTimeout(1_000);
};

test.beforeEach(async ({ page }) => {
  unexpected.length = 0;
  watchDiagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({}, testInfo: TestInfo) => {
  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
});

test("the integrated rebase reference shows the actual runtime in Helios and Selene", async ({ page }) => {
  await page.goto("/demo/dev-project/reference/derived-output-rebase", {
    waitUntil: "networkidle"
  });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("rebase landed");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".reb-metrics dd").nth(1)).toHaveText("7");

  await page.getByRole("link", { name: "02 Runtime", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Commit facts first");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await expect(page.locator(".reb-transaction-grid article")).toHaveCount(5);
  await expect(page.locator(".reb-queue-rules li")).toHaveCount(6);

  const appearance = page.getByRole("group", { name: "Appearance" });
  await appearance.getByRole("button", { name: "Selene" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "selene");
  await expect(page.locator(".reb-root")).toBeVisible();

  await appearance.getByRole("button", { name: "Helios" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "helios");
});

test("the procedure page renders all three diagrams and switches its callable spine", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/derived-output-flow", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("One text path in.");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);

  const generation = page.getByRole("tab", { name: /Prompt → response/ });
  await generation.click();
  await expect(generation).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".function-list")).toContainText("blockTypeOps");
  await expect(page.locator(".function-list")).toContainText("syncPromptBlockOps");
  await expect(page.locator(".function-list")).toContainText("querySemanticOverlay");

  const reading = page.getByRole("tab", { name: /ID → rendered value/ });
  await reading.click();
  await expect(page.locator(".function-list")).toContainText("readDerivedOutputValue");
  await page.screenshot({ path: "/tmp/derived-output-flow.png", fullPage: true });
});

test("the agent page renders its loop and exposes every core tool contract", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/agent-runtime", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("The agent gets");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);

  const find = page.getByRole("tab", { name: /find_resources/ });
  await find.click();
  await expect(find).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".tool-detail")).toContainText("Navigation does not mint factual evidence");

  const selection = page.getByRole("tab", { name: /read_selection/ });
  await selection.click();
  await expect(page.locator(".tool-detail")).toContainText("does not query the Semantic Overlay");

  await expect(page.getByRole("link", { name: /Find and view orient/ })).toHaveAttribute(
    "href",
    "/demo/semantic-overlay/resource-reading"
  );
  await page.screenshot({ path: "/tmp/derived-output-agent-runtime.png", fullPage: true });
});

test("the resource-reading page separates orientation from evidence", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/resource-reading", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read means cite");

  const view = page.getByRole("tab", { name: /view_slide/ });
  await view.click();
  await expect(view).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#tool-contract")).toContainText("ORIENTATION ONLY");
  await expect(page.locator("#tool-contract")).toContainText("deliberately returns no evidenceId");

  const image = page.getByRole("tab", { name: /read_image/ });
  await image.click();
  await expect(page.locator("#tool-contract")).toContainText("ISSUES EVIDENCE");
  await expect(page.locator("#tool-contract")).toContainText("original project image");

  await page.getByRole("tab", { name: /retrieve_materials/ }).click();
  await expect(page.locator("#tool-contract")).toContainText("separate material index");
  await expect(page.locator("#tool-contract")).toContainText("broad relevance claim");

  await page.getByRole("tab", { name: /read_code/ }).click();
  await expect(page.locator("#tool-contract")).toContainText("verbatim code");
  await expect(page.locator("#tool-contract")).toContainText("immutable file hash");

  await page.getByRole("tab", { name: /IMAGE \/ PIXELS ARE SOURCE/ }).click();
  await expect(page.locator(".route-ledger")).toContainText("visual · image-03");
  await expect(page.locator(".route-ledger")).toContainText("not selectable");

  await page.getByRole("button", { name: "Select image-03" }).click();
  await expect(page.locator(".next-call")).toContainText("read_image");
  await expect(page.locator(".next-call")).toContainText("visual evidence");
  await page.screenshot({ path: "/tmp/derived-output-resource-reading.png", fullPage: true });
});

test("the semantic material page separates discovery summaries from native authority", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/material-layer", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Search the meaning");
  await expect(page.locator(".machine-lanes")).toContainText("retrieve");
  await expect(page.locator(".machine-lanes")).toContainText("retrieve_materials");

  const image = page.getByRole("tab", { name: /IMAGE ASSET/ });
  await image.click();
  await expect(image).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#material-specimen")).toContainText("North station installation");
  await expect(page.locator("#material-specimen")).toContainText("Jina v4 image vector");
  await expect(page.locator("#material-specimen")).toContainText("read_image");
  await expect(page.locator(".facet-scope-gate")).toContainText("ANY(source, placement) ∈ set");
  await expect(page.locator(".facet-scope-gate")).toContainText("ALL(scopeRefs) ∈ set");

  await page.getByRole("tab", { name: /RELEVANT CODE/ }).click();
  await expect(page.locator(".query-console")).toContainText("pricing-engine.ts");
  await expect(page.locator(".query-route")).toContainText("read_code");
  await expect(page.locator(".evidence-ruler")).toContainText("DERIVED DESCRIPTOR");
  await page.screenshot({ path: "/tmp/semantic-material-layer.png", fullPage: true });
});

test("the semantic control room exposes every live intake signal and agent tool", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/ingestion-and-tools", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("When knowledge moves");
  await expect(page.locator(".hero-instruments")).toContainText("04");
  await expect(page.locator(".hero-instruments")).toContainText("16");

  const documentSave = page.getByRole("tab", { name: /Document save accepted/ });
  await documentSave.click();
  await expect(documentSave).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".signal-readout")).toContainText("submitDocumentChanges");
  await expect(page.locator(".signal-readout")).toContainText("semanticSyncJobs");
  await expect(page.locator(".signal-readout")).toContainText("semanticMaterialJobs");

  await page.getByRole("tab", { name: /Evidence 9/ }).click();
  await expect(page.locator(".tool-list button")).toHaveCount(9);
  await page.getByRole("button", { name: /retrieve_materials.*descriptor/ }).click();
  await expect(page.locator(".observation-window")).toContainText("EVIDENCE-PRODUCING");
  await expect(page.locator(".observation-window")).toContainText("broad claims only");

  await page.getByRole("tab", { name: /Orientation 7/ }).click();
  await expect(page.locator(".tool-list button")).toHaveCount(7);
  await page.getByRole("button", { name: /list_deck_slides.*context only/ }).click();
  await expect(page.locator(".observation-window")).toContainText("visible slide IDs");
  await expect(page.locator(".observation-window")).toContainText("cannot support a final claim");

  await page.getByRole("tab", { name: /All 16/ }).click();
  await expect(page.locator(".tool-list button")).toHaveCount(16);
  await page.screenshot({ path: "/tmp/semantic-ingestion-and-tools.png", fullPage: true });
});

test("the slide Prompt Block reference exposes the implemented editor and server boundary", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/slide-prompt-blocks", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("The slide stays a slide");
  await expect(page.locator(".mermaid-output svg")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(".diagram-error")).toHaveCount(0);

  const text = page.getByRole("tab", { name: /01 · Text/ });
  await text.click();
  await expect(text).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mini-inspector")).toContainText("Text box");
  await expect(page.locator(".text-element button")).toHaveCount(0);

  const published = page.getByRole("tab", { name: /04 · Publish/ });
  await published.click();
  await expect(page.locator(".text-element")).toContainText("92%");
  await expect(page.getByRole("button", { name: "Edit Prompt Block" })).toBeVisible();
  await expect(page.locator(".mini-inspector")).toContainText("EXACT TEXT");
  await expect(page.locator(".flight-map")).toContainText("one refresh worker");
  await page.screenshot({ path: "/tmp/slide-prompt-blocks-reference.png", fullPage: true });
});

test("the live proof exposes direct and named-variable generation", async ({ page }) => {
  await page.goto("/demo/semantic-overlay/derived-output-live", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Put a fact in one resource");
  await expect(page.getByLabel("Source document text")).toHaveValue(/fictional Atlas beacon/);
  await expect(page.getByLabel("Derived Output prompt")).toHaveValue(/what frequency/i);

  await page.getByRole("button", { name: /Named variables/ }).click();
  await expect(page.getByLabel("Output template")).toHaveValue(
    "{{beacon}} emits at {{frequency}} kilohertz."
  );
  await expect(page.locator(".variables")).toContainText("beacon");
  await expect(page.locator(".variables")).toContainText("frequency");
  await page.screenshot({ path: "/tmp/derived-output-live.png", fullPage: true });
});

test("the live proof completes against configured providers", async ({ page }) => {
  test.skip(
    process.env.ICARUS_LIVE_DERIVED_OUTPUT !== "1",
    "Set ICARUS_LIVE_DERIVED_OUTPUT=1 to spend real embedding and intelligence calls"
  );
  test.setTimeout(300_000);

  await page.goto("/demo/semantic-overlay/derived-output-live", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Run grounded generation/ }).click();

  await expect(page.locator(".result-card blockquote")).toContainText("37", { timeout: 240_000 });
  await expect(page.locator(".evidence")).toContainText("Atlas beacon emits at 37");
  await expect(page.locator(".evidence")).toContainText("documentBlock");
  await expect(page.locator(".result-card footer")).toContainText("derivedOutputs:");
});

test("the live proof resolves named variables against configured providers", async ({ page }) => {
  test.skip(
    process.env.ICARUS_LIVE_DERIVED_OUTPUT !== "1",
    "Set ICARUS_LIVE_DERIVED_OUTPUT=1 to spend real embedding and intelligence calls"
  );
  test.setTimeout(300_000);

  await page.goto("/demo/semantic-overlay/derived-output-live", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Named variables/ }).click();
  await page.getByRole("button", { name: /Run grounded generation/ }).click();

  await expect(page.locator(".result-card blockquote")).toContainText("37", { timeout: 240_000 });
  await expect(page.locator(".resolved")).toContainText("{{beacon}}");
  await expect(page.locator(".resolved")).toContainText("{{frequency}}");
  await expect(page.locator(".resolved")).toContainText("37");
  await expect(page.locator(".evidence")).toContainText("Atlas beacon emits at 37");
  await expect(page.locator(".evidence")).toContainText("documentBlock");
});

test("a document Prompt Block resolves a Derived Output from another resource", async ({ page }) => {
  test.skip(
    process.env.ICARUS_LIVE_DERIVED_OUTPUT !== "1",
    "Set ICARUS_LIVE_DERIVED_OUTPUT=1 to spend real embedding and intelligence calls"
  );
  test.setTimeout(420_000);

  // Create and save an ordinary source resource through the production editor path.
  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
  const tabs = page.getByRole("toolbar", { name: "Open tabs" });
  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page
    .locator(".area-editors")
    .getByRole("button", { name: "Document", exact: true })
    .click();
  await expect(page.locator(".title-bar h1")).toHaveText(/^Untitled document \d+$/);
  const sourceTitle = (await page.locator(".title-bar h1").textContent()) ?? "";
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("The Atlas beacon's calibration frequency is 27 kHz.");
  await expect(page.locator(".ProseMirror")).toContainText("calibration frequency is 27 kHz");
  await expect(page.locator(".title-bar")).toContainText("Saving");
  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 15_000 });

  // Create a second document, convert its empty line, and configure generation in the inspector.
  await tabs.locator('button.tab.icon[aria-label="New tab"]').click();
  await page
    .locator(".area-editors")
    .getByRole("button", { name: "Document", exact: true })
    .click();
  await expect(page.locator(".title-bar h1")).toHaveText(/^Untitled document \d+$/);
  const editor = page.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await editor.locator('.document-block[data-kind="text"]').first().click();

  const emptyInspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.empty-line"]'
  );
  await expect(emptyInspector).toBeVisible();
  await emptyInspector.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("option", { name: "Prompt", exact: true }).click();
  await expect(page.locator('.document-block[data-kind="prompt"]')).toHaveCount(1);

  const inspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.prompt-block"]'
  );
  await expect(inspector).toBeVisible();
  await inspector.getByLabel("Prompt").fill("What is the Atlas beacon's calibration frequency?");
  await expect(inspector).toContainText("Everything in the project");
  const generate = inspector.getByRole("button", { name: "Generate" });
  await expect(generate).toBeEnabled();
  await generate.click();

  const block = page.locator('.document-block[data-kind="prompt"]').last();
  await expect(block).toContainText("27", { timeout: 300_000 });
  const marker = page.locator('.lane .prompt-pin[data-prompt-block]').last();
  await expect(marker).toBeVisible();
  await expect(block.locator(".prompt-pin")).toHaveCount(0);

  // Generated output remains ordinary editor text: select it and use the shared mark controls.
  await block.dblclick({ position: { x: 35, y: 8 } });
  const textInspector = page.locator(
    'aside[aria-label="Inspector"][data-inspected="document-editor.text-selection"]'
  );
  await expect(textInspector).toBeVisible();
  const bold = textInspector.getByTitle("Bold");
  if ((await bold.getAttribute("data-state")) !== "on") await bold.click();
  await expect(block.locator("strong").first()).toBeVisible();

  await marker.click();
  await expect(inspector).toContainText("calibration frequency is 27 kHz");
  await expect(inspector.getByText("Current", { exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("heading", { name: "Details" })).toHaveCount(0);
  await expect(inspector.getByRole("heading", { name: "Placement" })).toHaveCount(0);
  await expect(inspector).not.toContainText("evidence-1");
  await expect(inspector).not.toContainText("derivedOutputs:");
  await expect(inspector.getByRole("button", { name: sourceTitle, exact: true })).toBeVisible();

  const refresh = inspector.getByRole("button", { name: "Refresh" });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(inspector).toBeVisible();
  await expect(inspector).toHaveAttribute("data-inspected", "document-editor.prompt-block");
  await expect(refresh).toBeEnabled({ timeout: 300_000 });
  await expect(block.locator("strong").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/derived-output-document-prompt.png", fullPage: true });

  await inspector.getByRole("button", { name: sourceTitle, exact: true }).click();
  await expect(page.locator(".title-bar h1")).toHaveText(sourceTitle);
  await restoreDocumentFixture(page);
});

test("architecture surfaces follow Helios and Selene", async ({ page }) => {
  test.setTimeout(120_000);
  for (const route of [
    "/demo/semantic-overlay/derived-output-flow",
    "/demo/semantic-overlay/agent-runtime",
    "/demo/semantic-overlay/resource-reading",
    "/demo/semantic-overlay/material-layer",
    "/demo/semantic-overlay/ingestion-and-tools",
    "/demo/semantic-overlay/slide-prompt-blocks",
    "/demo/semantic-overlay/derived-output-live"
  ]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const root = page.locator("html");
    const toHelios = page.getByRole("button", {
      name: /^(Helios|Switch to Celestial Helios)$/
    });
    if (await toHelios.isVisible()) await toHelios.click();
    else await page.evaluate(() => (document.documentElement.dataset.appearance = "helios"));
    await expect(root).toHaveAttribute("data-appearance", "helios");
    const surface = page.locator(".flow-page, .runtime-page, .reading-page, .material-page, .intake-page, .reference-page, .proof-shell").first();
    const day = await surface.evaluate((node) => getComputedStyle(node).backgroundColor);
    if (route === "/demo/semantic-overlay/resource-reading") {
      await page.screenshot({ path: "/tmp/derived-output-resource-reading-helios.png", fullPage: true });
    }
    if (route === "/demo/semantic-overlay/material-layer") {
      await page.screenshot({ path: "/tmp/semantic-material-layer-helios.png", fullPage: true });
    }
    if (route === "/demo/semantic-overlay/ingestion-and-tools") {
      await page.screenshot({ path: "/tmp/semantic-ingestion-and-tools-helios.png", fullPage: true });
    }
    if (route === "/demo/semantic-overlay/slide-prompt-blocks") {
      await page.screenshot({ path: "/tmp/slide-prompt-blocks-helios.png", fullPage: true });
    }

    const toSelene = page.getByRole("button", {
      name: /^(Selene|Switch to Celestial Selene)$/
    });
    if (await toSelene.isVisible()) await toSelene.click();
    else await page.evaluate(() => (document.documentElement.dataset.appearance = "selene"));
    await expect(root).toHaveAttribute("data-appearance", "selene");
    const night = await surface.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(night, `${route} should change its ground with appearance`).not.toBe(day);
    if (route === "/demo/semantic-overlay/resource-reading") {
      await page.screenshot({ path: "/tmp/derived-output-resource-reading-selene.png", fullPage: true });
    }
    if (route === "/demo/semantic-overlay/material-layer") {
      await page.screenshot({ path: "/tmp/semantic-material-layer-selene.png", fullPage: true });
    }
    if (route === "/demo/semantic-overlay/ingestion-and-tools") {
      await page.screenshot({ path: "/tmp/semantic-ingestion-and-tools-selene.png", fullPage: true });
    }
    if (route === "/demo/semantic-overlay/slide-prompt-blocks") {
      await page.screenshot({ path: "/tmp/slide-prompt-blocks-selene.png", fullPage: true });
    }
  }
});

test("architecture pages contain narrow overflow only inside intentional diagrams", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/demo/semantic-overlay/derived-output-flow",
    "/demo/semantic-overlay/agent-runtime",
    "/demo/semantic-overlay/resource-reading",
    "/demo/semantic-overlay/material-layer",
    "/demo/semantic-overlay/ingestion-and-tools",
    "/demo/semantic-overlay/slide-prompt-blocks"
  ]) {
    await page.goto(route, { waitUntil: "networkidle" });
    if (
      route === "/demo/semantic-overlay/derived-output-flow" ||
      route === "/demo/semantic-overlay/agent-runtime"
    ) {
      await expect(page.locator(".mermaid-output svg").first()).toBeVisible({ timeout: 20_000 });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      ),
      `${route} should keep wide diagrams inside their own scroll containers`
    ).toBe(true);
  }
});
