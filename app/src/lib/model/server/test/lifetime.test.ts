import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

/**
 * What the door promises about the one graph: it is built once, at a known
 * moment, and shutdown is one-way.
 *
 * The build moment is the point. `hooks.server.ts`'s `init` hook runs before the
 * server answers its first request, so there is exactly one build — which is why
 * there is no in-flight promise to cache, no race between concurrent first
 * callers, and no failed build to evict. All three used to be tested here, and
 * all three are now unreachable.
 *
 * The composition itself is replaced, because none of what is proven here is
 * about what a graph contains — and building a real one would read configuration
 * and open a log stream per test.
 */
const build = vi.hoisted(() => ({ calls: 0, fail: false, closes: 0 }));

vi.mock("$model/server/constructor.server", () => ({
  buildServerModel: async () => {
    build.calls += 1;
    if (build.fail) throw new Error("configuration was invalid");
    return {
      configuration: { get: () => undefined },
      observability: { logger: {}, close: async () => {} },
      persistence: { forProject: async () => ({}), close: async () => {} },
      close: async () => {
        build.closes += 1;
      }
    };
  }
}));

/** A fresh module registry per test, because the door holds process state. */
const door = () => import("$model/server/index.server");

beforeEach(() => {
  vi.resetModules();
  build.calls = 0;
  build.fail = false;
  build.closes = 0;
});

test("the accessor throws before the model is built", async () => {
  // An accessor returning `undefined` hands the failure to whoever reached the
  // model too early, and it surfaces later and elsewhere.
  const { serverModel } = await door();

  assert.throws(() => serverModel(), /has not been built/);
  assert.equal(build.calls, 0);
});

test("the initializer's graph is what the accessor returns", async () => {
  const { initServerModel, serverModel } = await door();

  const built = await initServerModel();

  assert.equal(serverModel(), built);
  // Repeated access is the same aggregate and the same leaves.
  assert.equal(serverModel().persistence, built.persistence);
  assert.equal(serverModel().configuration, built.configuration);
  assert.equal(build.calls, 1);
});

test("a failed build leaves nothing reachable", async () => {
  // The rejection is `init`'s to report, which fails startup. What matters here
  // is that no half-built graph is left behind for a request to find.
  const { initServerModel, serverModel } = await door();

  build.fail = true;
  await assert.rejects(initServerModel(), /configuration was invalid/);

  assert.throws(() => serverModel(), /has not been built/);
});

test("shutdown closes the graph once, however many times it is called", async () => {
  const { initServerModel, closeServerModel } = await door();

  await initServerModel();
  await closeServerModel();
  await closeServerModel();

  assert.equal(build.closes, 1);
});

test("nothing reaches the graph after shutdown begins", async () => {
  // The message has to say "shutting down" rather than "not built": a request
  // arriving during the drain is a different situation from one arriving before
  // startup finished, and only one of them is a defect.
  const { initServerModel, serverModel, closeServerModel } = await door();

  await initServerModel();
  await closeServerModel();

  assert.throws(() => serverModel(), /shutting down and cannot be rebuilt/);
  assert.equal(build.calls, 1);
});

test("shutdown with nothing built still refuses a later caller", async () => {
  const { serverModel, closeServerModel } = await door();

  await closeServerModel();

  assert.throws(() => serverModel(), /shutting down and cannot be rebuilt/);
  assert.equal(build.calls, 0);
});
