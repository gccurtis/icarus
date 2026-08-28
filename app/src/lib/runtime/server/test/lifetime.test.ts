import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

/**
 * What the door promises about the one graph: it is built once, at a known
 * moment, and shutdown is one-way.
 *
 * The build moment is the point. `hooks.server.ts`'s `init` hook runs before the
 * server answers its first request, so there is exactly one build — which is why
 * there is no in-flight promise to cache, no race between concurrent first
 * callers, and no failed build to evict. None of those three has a test here
 * because none of them is reachable.
 *
 * **The objects are replaced, not the composition.** None of what is proven here
 * is about what a graph contains, and building a real one would read
 * configuration and open a log stream per test — so the two object doors the
 * runtime imports are mocked and the real `buildServerModel` runs over them.
 * Substituting the builder itself is no longer possible: it shares a module with
 * the accessor under test, which is what makes them one file.
 */
const build = vi.hoisted(() => ({ calls: 0, fail: false, closes: 0 }));

vi.mock("$model/server/configuration/index.server", () => ({
  createConfiguration: async () => {
    build.calls += 1;
    if (build.fail) throw new Error("configuration was invalid");
    return { get: () => undefined };
  }
}));

vi.mock("$model/server/observability/index.server", () => ({
  createObservability: () => ({
    logger: { info: () => {} },
    close: async () => {
      build.closes += 1;
    }
  })
}));

/** A fresh module registry per test, because the door holds process state. */
const door = () => import("$runtime/server/start.server");

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
  assert.equal(serverModel().observability, built.observability);
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
