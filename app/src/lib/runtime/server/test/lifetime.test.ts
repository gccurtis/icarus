import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { serverInitialization } from "$runtime/server/initialization.server";

/**
 * What `start.server.ts` promises about the one graph: it is built once, at a
 * known moment, and shutdown is one-way.
 *
 * The build moment is the point. `hooks.server.ts`'s `init` hook runs before the
 * server answers its first request. An explicit in-flight promise still makes
 * accidental concurrent initializers join one build, while a completed or
 * closed lifecycle refuses initialization. Those boundaries are tested here.
 *
 * **The objects are replaced, not the composition.** None of what is proven here
 * is about what a graph contains, and building a real one would read
 * configuration and open a log stream per test — so the two objects the runtime
 * imports are mocked and the real `buildServerModel` runs over them.
 * Substituting the builder itself is no longer possible: it shares a module with
 * the accessor under test, which is what makes them one file.
 */
const build = vi.hoisted(() => ({
  calls: 0,
  fail: false,
  closes: 0,
  closeGate: undefined as Promise<void> | undefined,
  closeFailure: undefined as Error | undefined,
  closeStarted: undefined as (() => void) | undefined
}));

vi.mock("$model/server/configuration/index.server", () => ({
  createConfiguration: async () => {
    build.calls += 1;
    if (build.fail) throw new Error("configuration was invalid");
    return {
      get: (key: string) => key === "externalFiles.upload.maxPathBytes" ? 512 : undefined
    };
  }
}));

vi.mock("$model/server/external-file-storage/index.server", () => ({
  createExternalFileStorage: () => ({
    acquireMutation: async () => () => {},
    put: async () => { throw new Error("not used"); },
    claimPublication: async () => {},
    discardPublication: async () => {},
    releaseClaim: async () => {},
    read: async () => undefined,
    remove: async () => "already-missing" as const,
    reconcile: async () => ({ removedTemporaryFiles: 0, removedOrphanBlobs: 0, retainedBlobs: 0 })
  })
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
      build.closeStarted?.();
      await build.closeGate;
      if (build.closeFailure !== undefined) throw build.closeFailure;
    }
  })
}));

vi.mock("$model/server/store/index.server", () => ({
  readCurrentRows: (
    store: { read: (path: string) => unknown },
    table: string
  ) => {
    const found = store.read(table) as {
      kind?: unknown;
      table?: unknown;
      rows?: unknown;
    } | undefined;
    if (found?.kind !== "table" || found.table !== table || !Array.isArray(found.rows)) {
      throw new Error(`the Store did not return the '${table}' table`);
    }
    return found.rows;
  },
  createStore: () => ({
    create: () => "projects:1",
    read: (path: string) => path === "externalFiles" || path === "agentTasks"
      ? { kind: "table", table: path, rows: [] }
      : undefined,
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
  build.closeGate = undefined;
  build.closeFailure = undefined;
  build.closeStarted = undefined;
});

const shutdownChannel = (initial: readonly (() => void)[] = []) => {
  const listeners = new Set(initial);
  return {
    listeners,
    channel: {
      listeners: () => [...listeners],
      add: (listener: () => void) => {
        listeners.add(listener);
      },
      remove: (listener: () => void) => {
        listeners.delete(listener);
      }
    }
  };
};

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

test("concurrent initializers join one in-flight graph build", async () => {
  const { initServerModel, serverModel } = await entry();

  const first = initServerModel();
  const second = initServerModel();
  const [left, right] = await Promise.all([first, second]);

  assert.equal(left, right);
  assert.equal(serverModel(), left);
  assert.equal(build.calls, 1);
});

test("a completed initializer cannot replace the process graph", async () => {
  const { initServerModel, serverModel } = await entry();
  const built = await initServerModel();

  await assert.rejects(initServerModel(), /already been initialized/);

  assert.equal(serverModel(), built);
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
  await assert.rejects(initServerModel(), /shutting down and cannot be initialized/);
  assert.equal(build.calls, 1);
});

test("shutdown with nothing built still refuses a later caller", async () => {
  const { serverModel, closeServerModel } = await entry();

  await closeServerModel();

  assert.throws(() => serverModel(), /shutting down and cannot be rebuilt/);
  assert.equal(build.calls, 0);
});

test("an incoming owner cannot initialize while the outgoing graph is closing", async () => {
  const { channel } = shutdownChannel();
  const outgoing = await entry();
  outgoing.ownServerModelLifetime(channel, () => {});
  await outgoing.initServerModel();

  let allowClose!: () => void;
  build.closeGate = new Promise<void>((resolve) => {
    allowClose = resolve;
  });
  const closeStarted = new Promise<void>((resolve) => {
    build.closeStarted = resolve;
  });

  vi.resetModules();
  const incoming = await entry();
  const outgoingRelease = incoming.ownServerModelLifetime(channel, () => {});
  const initialize = serverInitialization(outgoingRelease, () => incoming.initServerModel());
  const starting = initialize();

  await closeStarted;
  assert.equal(build.calls, 1);
  allowClose();
  await starting;

  assert.equal(build.closes, 1);
  assert.equal(build.calls, 2);
});

test("a failed outgoing release is reported and prevents the incoming graph", async () => {
  const { channel } = shutdownChannel();
  const outgoing = await entry();
  outgoing.ownServerModelLifetime(channel, () => {});
  await outgoing.initServerModel();

  const failure = new Error("outgoing close failed");
  build.closeFailure = failure;
  const reported: unknown[] = [];

  vi.resetModules();
  const incoming = await entry();
  const outgoingRelease = incoming.ownServerModelLifetime(
    channel,
    (error) => reported.push(error)
  );
  const initialize = serverInitialization(outgoingRelease, () => incoming.initServerModel());

  await assert.rejects(initialize(), (error) => error === failure);
  assert.equal(build.calls, 1);
  assert.equal(build.closes, 1);
  assert.deepEqual(reported, [failure]);
});

test("the owned shutdown listener closes terminally and preserves unrelated listeners", async () => {
  const unrelated = () => {};
  const { channel, listeners } = shutdownChannel([unrelated]);
  const failures: unknown[] = [];
  const current = await entry();
  current.ownServerModelLifetime(channel, (error) => failures.push(error));
  await current.initServerModel();

  const owned = [...listeners].find((listener) => listener !== unrelated);
  assert.ok(owned);
  owned();
  await current.closeServerModel();

  assert.equal(build.closes, 1);
  assert.equal(listeners.has(unrelated), true);
  assert.throws(() => current.serverModel(), /shutting down/);
  await assert.rejects(current.initServerModel(), /shutting down/);
  assert.deepEqual(failures, []);
});
