import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

/**
 * What `start.server.ts` promises about the one graph: it is built once, at a
 * known moment, and shutdown is one-way.
 *
 * The build moment is the point. `hooks.server.ts`'s `init` hook runs before the
 * server answers its first request, so there is exactly one build — which is why
 * there is no in-flight promise to cache, no race between concurrent first
 * callers, and no failed build to evict. None of those three has a test here
 * because none of them is reachable.
 *
 * **The objects are replaced, not the composition.** None of what is proven here
 * is about what a graph contains, and building a real one would read
 * configuration and open a log stream per test — so the two objects the runtime
 * imports are mocked and the real `buildServerModel` runs over them.
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
    logger: { info: () => {} },
    close: async () => {
      build.closes += 1;
    }
  })
}));

vi.mock("$model/server/store/index.server", () => ({
  createStore: () => ({
    create: () => "projects:1",
    read: () => undefined,
    update: () => {},
    remove: () => {}
  })
}));

/** A fresh module registry per test, because the module holds process state. */
const entry = () => import("$runtime/server/start.server");

beforeEach(() => {
  vi.resetModules();
  build.calls = 0;
  build.fail = false;
  build.closes = 0;
});

test("the accessor throws before the model is built", async () => {
  // An accessor returning `undefined` hands the failure to whoever reached the
  // model too early, and it surfaces later and elsewhere.
  const { serverModel } = await entry();

  assert.throws(() => serverModel(), /has not been built/);
  assert.equal(build.calls, 0);
});

test("the initializer's graph is what the accessor returns", async () => {
  const { initServerModel, serverModel } = await entry();

  const built = await initServerModel();

  assert.equal(serverModel(), built);
  // Repeated access is the same aggregate and the same leaves.
  assert.equal(serverModel().intelligence, built.intelligence);
  assert.equal(serverModel().observability, built.observability);
  assert.equal(serverModel().configuration, built.configuration);
  assert.equal(build.calls, 1);
});

test("a failed build leaves nothing reachable", async () => {
  // The rejection is `init`'s to report, which fails startup. What matters here
  // is that no half-built graph is left behind for a request to find.
  const { initServerModel, serverModel } = await entry();

  build.fail = true;
  await assert.rejects(initServerModel(), /configuration was invalid/);

  assert.throws(() => serverModel(), /has not been built/);
});

test("shutdown closes the graph once, however many times it is called", async () => {
  const { initServerModel, closeServerModel } = await entry();

  await initServerModel();
  await closeServerModel();
  await closeServerModel();

  assert.equal(build.closes, 1);
});

test("nothing reaches the graph after shutdown begins", async () => {
  // The message has to say "shutting down" rather than "not built": a request
  // arriving during the drain is a different situation from one arriving before
  // startup finished, and only one of them is a defect.
  const { initServerModel, serverModel, closeServerModel } = await entry();

  await initServerModel();
  await closeServerModel();

  assert.throws(() => serverModel(), /shutting down and cannot be rebuilt/);
  assert.equal(build.calls, 1);
});

test("shutdown with nothing built still refuses a later caller", async () => {
  const { serverModel, closeServerModel } = await entry();

  await closeServerModel();

  assert.throws(() => serverModel(), /shutting down and cannot be rebuilt/);
  assert.equal(build.calls, 0);
});

test("hot replacement removes its listener and releases before reinitialization", async () => {
  const {
    closeServerModel,
    initServerModel,
    ownServerModelLifetime
  } = await entry();
  await initServerModel();

  const listeners = new Set<() => void>();
  const data: {
    icarusServerModelRelease?: Promise<void>;
    icarusServerShutdownListener?: () => void;
  } = {};
  const disposals: Array<(held: typeof data) => void> = [];
  const failures: unknown[] = [];
  const hot = {
    data,
    dispose: (callback: (held: typeof data) => void) => {
      disposals.push(callback);
    }
  };
  const channel = {
    add: (listener: () => void) => {
      listeners.add(listener);
    },
    remove: (listener: () => void) => {
      listeners.delete(listener);
    }
  };
  const reportFailure = (error: unknown) => {
    failures.push(error);
  };

  const firstPendingRelease = ownServerModelLifetime(channel, hot, reportFailure);
  assert.equal(firstPendingRelease, undefined);
  assert.equal(listeners.size, 1);
  assert.equal(disposals.length, 1);

  disposals[0]?.(data);
  assert.equal(listeners.size, 0);
  assert.ok(data.icarusServerModelRelease instanceof Promise);
  await data.icarusServerModelRelease;
  assert.equal(build.closes, 1);

  await initServerModel();
  assert.equal(build.calls, 2);

  const secondPendingRelease = ownServerModelLifetime(channel, hot, reportFailure);
  assert.equal(secondPendingRelease, data.icarusServerModelRelease);
  assert.equal(listeners.size, 1);

  for (const listener of listeners) listener();
  await closeServerModel();

  assert.equal(build.closes, 2);
  assert.deepEqual(failures, []);
});

test("hot registration replaces a surviving listener instead of accumulating", async () => {
  const { ownServerModelLifetime } = await entry();
  const listeners = new Set<() => void>();
  const data: {
    icarusServerModelRelease?: Promise<void>;
    icarusServerShutdownListener?: () => void;
  } = {};
  const hot = {
    data,
    dispose: (_callback: (held: typeof data) => void) => {}
  };
  const channel = {
    add: (listener: () => void) => {
      listeners.add(listener);
    },
    remove: (listener: () => void) => {
      listeners.delete(listener);
    }
  };

  ownServerModelLifetime(channel, hot, () => {});
  ownServerModelLifetime(channel, hot, () => {});

  assert.equal(listeners.size, 1);
  assert.equal(listeners.has(data.icarusServerShutdownListener!), true);
});
