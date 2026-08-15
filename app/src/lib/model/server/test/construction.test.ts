import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { buildServerModel } from "$model/server/constructor.server";

/**
 * Composition order, and what happens to what was already acquired when a later
 * step fails.
 *
 * The leaves are replaced by fakes that record when they were closed. Order and
 * cleanup are the whole of what the composition root decides; a real
 * configuration read and a real log stream would prove neither.
 */
const graph = vi.hoisted(() => ({
  order: [] as string[],
  persistenceFails: false,
  records: [] as string[]
}));

vi.mock("$model/server/configuration/index.server", () => ({
  createConfiguration: async () => ({ get: () => undefined })
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

vi.mock("$model/server/persistence/index.server", () => ({
  createPersistence: () => {
    if (graph.persistenceFails) throw new Error("projects directory was unreadable");
    return {
      forProject: async () => ({}),
      close: async () => {
        graph.order.push("persistence");
      }
    };
  }
}));

beforeEach(() => {
  graph.order = [];
  graph.records = [];
  graph.persistenceFails = false;
});

test("closes databases before logging", async () => {
  // Flushing the logger first would drop exactly the records that say whether
  // the databases closed.
  const model = await buildServerModel();

  await model.close();

  assert.deepEqual(graph.order, ["persistence", "observability"]);
});

test("the graph names every object it built", async () => {
  const model = await buildServerModel();

  assert.ok(model.configuration);
  assert.ok(model.observability);
  assert.ok(model.persistence);
  assert.deepEqual(graph.records, ["model.started"]);
});

test("a failed construction releases what it had already acquired", async () => {
  // Logging is opened before persistence and is the thing that reports the
  // failure, so it is also the thing that would be left holding a stream nobody
  // closes.
  graph.persistenceFails = true;

  await assert.rejects(buildServerModel(), /projects directory was unreadable/);

  assert.deepEqual(graph.order, ["observability"]);
  assert.deepEqual(graph.records, ["model.start.failed"]);
});
