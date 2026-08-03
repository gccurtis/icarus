import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { createApp } from "../../src/1-init/create/app.js";
import { UNBOUNDED_BODY_BYTES } from "../../src/0-utils/config/loadBackendConfig.js";
import { JobScheduler } from "../../src/0-utils/jobs/scheduler.js";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { registerHttpTransport } from "../../src/2-transport/registerHttpTransport.js";
import { OpenRouterProvider } from "../../src/0-platform/intelligence/openrouter/provider.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const backendPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as {
  imports?: Record<string, unknown>;
  scripts?: Record<string, string>;
};

test("General Files and Connector aliases are available to the built runtime", () => {
  const imports = backendPackage.imports ?? {};
  for (const alias of [
    "#general-files",
    "#general-files/*",
    "#connector",
    "#connector/*",
    "#templates",
    "#templates/*"
  ]) {
    assert.ok(alias in imports, `missing package import alias: ${alias}`);
  }
});

test("the backend dev command selects TypeScript source imports instead of stale dist files", () => {
  assert.match(
    backendPackage.scripts?.dev ?? "",
    /--conditions=(?:types|development)/
  );
});

// Every other test in the suite imports concrete modules directly, so a broken
// composition root is invisible to them: the tree can fail `tsc` and fail to boot
// while the suite stays green. That is exactly what happened while Slide carried a
// barrel re-exporting a service file that was never written.
//
// The import is dynamic rather than top-level on purpose. A static import that
// failed would take the whole file down with it, hiding the other assertions here
// behind a module-load error; this way a broken graph is one failing test with a
// readable message.
//
// Known limit, verified by deliberately breaking startBackend both ways: this
// catches an unresolvable import whose binding is *used* at runtime, but not one
// that is unused or type-only — esbuild elides those before Node ever resolves
// them. `tsc` is what covers that case, which is the argument for running
// `pnpm typecheck` alongside `pnpm test` rather than treating this as a
// substitute for it.
test("the composition root's module graph resolves", async () => {
  const composition = await import("#init/startBackend.js");

  assert.equal(
    typeof composition.startBackend,
    "function",
    "startBackend must be exported as a function"
  );
});

test("the job runtime logs queue timing and deferred failures through Logger", async () => {
  const logger = new CapturingLogger();
  const scheduler = new JobScheduler(
    {
      concurrentWorkers: 1,
      serialQueueMaxSize: 2,
      concurrentQueueMaxSize: 2
    },
    logger
  );
  let signalWorkStarted!: () => void;
  const workStarted = new Promise<void>((resolve) => {
    signalWorkStarted = resolve;
  });

  const result = await scheduler.enqueue({
    id: "job-observability-test",
    requestId: "request-observability-test",
    name: "test.deferred",
    queueType: "concurrent",
    responseMode: "deferred",
    deferredWork: async () => ({ statusCode: 202 }),
    work: async () => {
      signalWorkStarted();
      throw new Error("expected deferred failure");
    }
  });

  assert.equal(result.response.statusCode, 202);
  assert.equal(result.requestId, "request-observability-test");
  await workStarted;
  await yieldToEventLoop();

  for (const message of [
    "job.enqueued",
    "job.started",
    "job.responded",
    "job.deferred.failed"
  ]) {
    assert.ok(
      logger.entries.some((entry) => entry.message === message),
      `missing scheduler log: ${message}`
    );
  }

  const failure = logger.entries.find(
    (entry) => entry.message === "job.deferred.failed"
  );
  assert.deepEqual(failure?.data, {
    jobId: "job-observability-test",
    requestId: "request-observability-test",
    jobName: "test.deferred",
    queueType: "concurrent",
    responseMode: "deferred",
    queueWaitMs: (failure?.data as { queueWaitMs: number }).queueWaitMs,
    durationMs: (failure?.data as { durationMs: number }).durationMs,
    errorName: "Error",
    errorMessage: "expected deferred failure"
  });
});

test("HTTP requests and jobs share request correlation in the application Logger", async () => {
  const logger = new CapturingLogger();
  const scheduler = new JobScheduler(
    {
      concurrentWorkers: 1,
      serialQueueMaxSize: 2,
      concurrentQueueMaxSize: 2
    },
    logger
  );
  const registry = new JobRegistry();
  registry.register({ method: "GET", path: "/logging-probe" }, () => ({
    name: "test.logging-probe",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => ({ statusCode: 204 })
  }));
  const app = createApp(UNBOUNDED_BODY_BYTES);
  registerHttpTransport(app, { scheduler, registry, logger });

  const response = await app.inject({ method: "GET", url: "/logging-probe" });
  await app.close();

  assert.equal(response.statusCode, 204);
  const completed = logger.entries.find(
    (entry) => entry.message === "http.request.completed"
  );
  assert.ok(completed);
  const requestData = completed.data as {
    requestId: string;
    jobId: string;
    durationMs: number;
  };
  assert.ok(requestData.requestId);
  assert.ok(requestData.jobId);
  assert.ok(requestData.durationMs >= 0);

  const started = logger.entries.find(
    (entry) => entry.message === "job.started"
  );
  assert.equal(
    (started?.data as { requestId?: string }).requestId,
    requestData.requestId
  );
});

test("provider HTTP failures do not leak response bodies into diagnostics", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("sensitive provider response", {
      status: 400,
      headers: { "x-request-id": "provider-request-1" }
    });

  try {
    const provider = new OpenRouterProvider({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid",
      timeoutMs: 1_000
    });
    await assert.rejects(
      provider.embed(undefined, { model: "test-model", inputs: ["private input"] }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /400/);
        assert.match(error.message, /provider-request-1/);
        assert.doesNotMatch(error.message, /sensitive provider response/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("startup and deferred job failures do not bypass the shared Logger", () => {
  for (const relativePath of [
    "../../src/index.ts",
    "../../src/0-utils/jobs/scheduler.ts"
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /console\.(?:debug|info|log|warn|error)\s*\(/);
  }
});

test("recurring Connector sync starts only after the HTTP listener binds", () => {
  const source = readFileSync(
    new URL("../../src/1-init/startBackend.ts", import.meta.url),
    "utf8"
  );
  const listenAt = source.indexOf("await app.listen");
  const schedulerAt = source.indexOf("syncScheduler.start()");

  assert.ok(listenAt >= 0, "startup no longer binds the HTTP listener");
  assert.ok(schedulerAt > listenAt, "sync timers can survive a failed listener bind");
});
