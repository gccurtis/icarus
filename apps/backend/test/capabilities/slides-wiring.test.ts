import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApp } from "../../src/1-init/create/app.js";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { JobScheduler } from "../../src/0-utils/jobs/scheduler.js";
import { registerHttpTransport } from "../../src/2-transport/registerHttpTransport.js";
import type { SlidesCapability } from "../../src/3-capabilities/slides/index.js";
import { DeckNotFoundError } from "../../src/3-capabilities/slides/domain/errors.js";
import { registerSlidesEndpoints } from "../../src/4-job-wiring/slides/registerSlidesEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const backendPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { imports?: Record<string, unknown> };

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 4,
  concurrentQueueMaxSize: 4
};

test("Slides aliases are available to the built runtime", () => {
  const imports = backendPackage.imports ?? {};
  for (const alias of ["#slides", "#slides/*"]) {
    assert.ok(alias in imports, `missing package import alias: ${alias}`);
  }
});

/** Throws whatever the test hands it, so the error ladder can be exercised. */
const createHarness = (failure: () => never) => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry();
  const slides: SlidesCapability = {
    command: async () => failure(),
    query: async () => failure(),
    compact: async () => false,
    publishPendingActivity: async () => 0
  };
  registerSlidesEndpoints(registry, slides, logger);
  const app = createApp();
  registerHttpTransport(app, {
    scheduler: new JobScheduler(schedulerConfig, logger),
    registry,
    logger
  });
  return { app, logger };
};

const createDeck = { origin: "interactive", command: { type: "deck.create", title: "D" } };

test("an unexpected failure is a 500 that records the error message, not just its name", async (t) => {
  // The real case this comes from: knowledge.add reaches an embedding provider,
  // the provider answers 401, and a bare Error arrives here. Logging only the
  // name makes that indistinguishable from a null dereference, and this record
  // is the only one written for a 500.
  const { app, logger } = createHarness(() => {
    throw new Error("Embedding request failed with status 401");
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/slides/command",
    payload: createDeck
  });
  assert.equal(response.statusCode, 500);
  // The caller is told nothing specific; the operator is told everything.
  assert.deepEqual(response.json(), {
    error: "internal_error",
    message: "Slides operation failed"
  });

  const failed = logger.entries.find((record) => record.message === "slides.command.failed");
  assert.equal(failed?.level, "error");
  const data = failed?.data as { errorName: string; errorMessage: string };
  assert.equal(data.errorName, "Error");
  assert.equal(data.errorMessage, "Embedding request failed with status 401");
});

test("a mapped domain error keeps its status and is not logged as a fault", async (t) => {
  const { app, logger } = createHarness(() => {
    throw new DeckNotFoundError("deck-1");
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/slides/command",
    payload: createDeck
  });
  assert.equal(response.statusCode, 404);
  // Only 500s are the wiring layer's problem to shout about; a 404 is an
  // ordinary answer and the service has already logged it.
  assert.equal(
    logger.entries.some((record) => record.message === "slides.command.failed"),
    false
  );
});
