import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { buildServerModel } from "$model/server/constructor.server";

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

beforeEach(() => {
  graph.order = [];
  graph.records = [];
});

test("the graph names every object it built", async () => {
  const model = await buildServerModel();

  assert.ok(model.configuration);
  assert.ok(model.observability);
  assert.deepEqual(graph.records, ["model.started"]);
});

test("closing the graph closes what it holds", async () => {
  const model = await buildServerModel();

  await model.close();

  assert.deepEqual(graph.order, ["observability"]);
});
