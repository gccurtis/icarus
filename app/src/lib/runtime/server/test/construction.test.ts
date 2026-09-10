import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import {
  closeServerModel,
  initServerModel,
  resetServerModelForBrowserHarness,
  serverModel
} from "$runtime/server/start.server";

/**
 * Composition order, and what the graph names when it is built.
 *
 * The leaves are replaced by fakes that record when they were closed. Order and
 * cleanup are the whole of what the composition root decides; a real
 * configuration read and a real log stream would prove neither.
 *
 * Release ordering and the failure path are not tested here because neither is
 * expressible against one closable object: nothing is acquired after the last
 * step that can throw. Both need a case the day a second one is.
 */
const graph = vi.hoisted(() => ({
  order: [] as string[],
  records: [] as string[]
}));

vi.mock("$model/server/configuration/index.server", () => ({
  createConfiguration: async () => ({ get: () => undefined })
}));

vi.mock("$model/server/embedding/index.server", () => ({
  createEmbedding: () => ({
    space: { provider: "jina", model: "test", dimensions: 2 },
    tokenField: async () => ({ value: { labels: [], vectors: [] }, usage: {} }),
    passages: async () => ({ value: [], usage: {} }),
    query: async () => ({ value: [], usage: {} })
  })
}));

vi.mock("$model/server/intelligence/index.server", () => ({
  createIntelligence: () => ({ completeWithTools: async () => ({ value: "", toolCalls: [] }) })
}));

vi.mock("$model/server/observability/index.server", () => ({
  createObservability: () => ({
    logger: {
      debug: () => {},
      info: (message: string) => graph.records.push(message),
      warn: () => {},
      error: (message: string) => graph.records.push(message)
    },
    close: async () => {
      graph.order.push("observability");
    }
  }),
  errorFields: (error: unknown) => ({ errorMessage: String(error) })
}));

vi.mock("$model/server/store/index.server", () => ({
  createStore: () => ({
    create: () => "projects:1",
    read: () => undefined,
    update: () => {},
    remove: () => {}
  })
}));

beforeEach(() => {
  graph.order = [];
  graph.records = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("the graph names every object it built", async () => {
  const model = await initServerModel();

  assert.ok(model.intelligence);
  assert.ok(model.operationFlights);
  assert.ok(model.embedding);
  assert.ok(model.configuration);
  assert.ok(model.observability);
  assert.ok(model.store);
  assert.deepEqual(graph.records, ["model.started"]);
});

test("closing the graph closes what it holds", async () => {
  const model = await initServerModel();

  await model.close();

  assert.deepEqual(graph.order, ["observability"]);
});

test("a browser reset drains terminal operation work before restoring the Store", async () => {
  vi.stubEnv("ICARUS_BROWSER_RESET_TOKEN", "test-reset");
  vi.stubEnv("ICARUS_BROWSER_RESET_DIRECTORY", "/tmp/icarus-browser-store-test");
  const model = await initServerModel();
  let finishTerminalWrite!: () => void;
  const terminalWrite = new Promise<void>((resolve) => {
    finishTerminalWrite = resolve;
  });
  let signal: AbortSignal | undefined;
  const flight = model.operationFlights.shareDerived(
    "output:reset",
    "definition:1",
    async (ownedSignal) => {
      signal = ownedSignal;
      await terminalWrite;
      graph.order.push("terminal-write");
    }
  );
  await Promise.resolve();

  const first = resetServerModelForBrowserHarness(() => {
    graph.order.push("restore:first");
  });
  const second = resetServerModelForBrowserHarness(() => {
    graph.order.push("restore:second");
  });
  await Promise.resolve();

  assert.equal(signal?.aborted, true);
  assert.deepEqual(graph.order, []);

  finishTerminalWrite();
  await flight.promise;
  await Promise.all([first, second]);

  assert.deepEqual(graph.order, [
    "terminal-write",
    "observability",
    "restore:first",
    "observability",
    "restore:second"
  ]);
});

test("a browser reset can restore the graph after an earlier restore failed", async () => {
  vi.stubEnv("ICARUS_BROWSER_RESET_TOKEN", "test-reset");
  vi.stubEnv("ICARUS_BROWSER_RESET_DIRECTORY", "/tmp/icarus-browser-store-test");
  await initServerModel();

  await assert.rejects(
    resetServerModelForBrowserHarness(() => {
      graph.order.push("restore:failed");
      throw new Error("seed copy failed");
    }),
    /seed copy failed/
  );
  assert.throws(serverModel, /has not been built/);

  await resetServerModelForBrowserHarness(() => {
    graph.order.push("restore:retry");
  });

  assert.ok(serverModel());
  assert.deepEqual(graph.order, ["observability", "restore:failed", "restore:retry"]);
});

test("production shutdown callers join the drain and cannot admit new work", async () => {
  const model = await initServerModel();
  let finishTerminalWrite!: () => void;
  const terminalWrite = new Promise<void>((resolve) => {
    finishTerminalWrite = resolve;
  });
  let signal: AbortSignal | undefined;
  const flight = model.operationFlights.shareDerived(
    "output:shutdown",
    "definition:1",
    async (ownedSignal) => {
      signal = ownedSignal;
      await terminalWrite;
      graph.order.push("terminal-write");
    }
  );
  await Promise.resolve();

  const first = closeServerModel();
  const second = closeServerModel();
  await Promise.resolve();

  assert.equal(first, second);
  assert.equal(signal?.aborted, true);
  assert.throws(serverModel, /shutting down/);
  assert.throws(() => model.operationFlights.beginResearch("turn:late"), /closed/);
  assert.deepEqual(graph.order, []);

  finishTerminalWrite();
  await flight.promise;
  await first;

  assert.deepEqual(graph.order, ["terminal-write", "observability"]);
});
