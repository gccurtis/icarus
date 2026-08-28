import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { clientModel, initClientModel } from "$runtime/client/start";
import type { ClientStorage, PersistedWorkbench } from "$model/client/storage";
import { DEFAULT_FRAME, SINGLETON_SCREENS } from "$model/client/workbench";
import type { TabTarget } from "$model/client/workbench";

/**
 * What the composition root is for.
 *
 * Each object can be built alone, and its own tests do that. This file tests
 * what only the root can show: that a whole graph stands up from one call, that
 * two graphs share nothing, and that the accessor reports both of its refusals
 * where they are asked for rather than handing back `undefined`.
 *
 * The order matters once. `clientModel()` is asked before anything initializes
 * it, and there is one module instance per test file, so that assertion has to
 * come first.
 *
 * `browser` is a getter rather than a constant, because this suite runs under
 * the node environment and the accessor's first refusal is exactly the one a
 * node environment would trip on. A test that could not turn it off would be
 * testing the guard and nothing below it.
 */
const env = vi.hoisted(() => ({ browser: true }));

vi.mock("$app/environment", () => ({
  get browser() {
    return env.browser;
  }
}));

/**
 * What the layout's server load publishes, as a literal.
 *
 * Spelled out rather than defaulted, because `ClientModelInput.configuration` is
 * required precisely so a graph is never built over values nobody chose — and a
 * test that let it default would be proving the opposite of that.
 */
const settings = { revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } } };

const document: TabTarget = { kind: "resource", resourceType: "document", resourceId: "other" };

const fakeStorage = (initial?: PersistedWorkbench): ClientStorage => {
  let workbench = initial;
  return {
    get workbench() {
      return workbench;
    },
    saveWorkbench: (value: PersistedWorkbench) => (workbench = value)
  };
};

test("the accessor throws before the model is built", () => {
  assert.throws(() => clientModel(), /has not been built/);
});

test("the accessor refuses a server path in its own words", () => {
  // A category error, not a question of order: the graph belongs to a tab, and
  // no amount of waiting produces one on the server.
  env.browser = false;
  try {
    assert.throws(() => clientModel(), /browser-only/);
  } finally {
    env.browser = true;
  }
});

test("builds the whole graph over one input", () => {
  const model = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });

  assert.equal(model.project, "alpha");
  assert.ok(model.storage);
  assert.ok(model.workbench);
});

test("configuration is built over the snapshot the root was given", () => {
  // The published slice reaches the graph unchanged, so an object constructed
  // below it reads the value the deployment configured rather than a literal.
  const model = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });

  assert.equal(model.configuration.get("revisions.changeSets.flushAfterOps"), 50);
  assert.equal(model.configuration.get("revisions.changeSets.flushAfterMs"), 2000);
});

test("two models do not share a configuration", () => {
  const a = initClientModel({
    project: "alpha",
    configuration: { revisions: { changeSets: { flushAfterOps: 10, flushAfterMs: 500 } } },
    storage: fakeStorage()
  });
  const b = initClientModel({ project: "beta", configuration: settings, storage: fakeStorage() });

  assert.notEqual(a.configuration, b.configuration);
  assert.equal(a.configuration.get("revisions.changeSets.flushAfterOps"), 10);
  assert.equal(b.configuration.get("revisions.changeSets.flushAfterOps"), 50);
});

test("the workbench is built over the register the root handed it", () => {
  // Not a second register: opening a resource tab attaches through the one the
  // root constructed, which is what makes `runtimeFor` and `flushing` agree.
  const model = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });

  model.workbench.open(document);

  assert.deepEqual(model.resourceRuntimes.open, ["document:other"]);
});

test("storage is built and, for now, read by nothing", () => {
  // The workbench does not persist while its stored shape is unsettled, and
  // storage holds exactly that one section. It stands intact and unused rather
  // than being torn out and rebuilt when persistence returns.
  const storage = fakeStorage();
  const model = initClientModel({ project: "alpha", configuration: settings, storage });

  model.workbench.open(document);

  assert.equal(model.storage, storage);
  assert.equal(storage.workbench, undefined);
});

test("two models share nothing", () => {
  // The assertion the whole shape exists for, at the level a component sees.
  const a = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });
  const b = initClientModel({ project: "beta", configuration: settings, storage: fakeStorage() });

  a.workbench.open(document);
  a.workbench.resize({ contextWidth: 400 });
  a.workbench.inspect("block.text-selection");

  assert.equal(b.workbench.tabs.length, SINGLETON_SCREENS.length);
  assert.equal(b.workbench.frame.contextWidth, DEFAULT_FRAME.contextWidth);
  assert.equal(b.workbench.inspectedNode, undefined);
  assert.deepEqual(b.resourceRuntimes.open, []);
  assert.notEqual(a.project, b.project);
  assert.notEqual(a.storage, b.storage);
  assert.notEqual(a.workbench, b.workbench);
});

test("close releases every runtime the workbench opened", () => {
  const model = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });
  model.workbench.open(document);

  model.close();

  assert.deepEqual(model.resourceRuntimes.open, []);
  assert.equal(model.workbench.tabs.length, SINGLETON_SCREENS.length);
});

test("one model's writes reach only its own graph", () => {
  // The frame is what a write lands in while persistence is paused, and it is
  // per tab — so it is the cheapest thing to prove two graphs do not share.
  const a = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });
  const b = initClientModel({ project: "beta", configuration: settings, storage: fakeStorage() });

  a.workbench.resize({ inspectorWidth: 500 });

  assert.equal(a.workbench.frame.inspectorWidth, 500);
  assert.equal(b.workbench.frame.inspectorWidth, DEFAULT_FRAME.inspectorWidth);
});

test("the initializer's graph is what the accessor returns", () => {
  const initialized = initClientModel({ project: "alpha", configuration: settings, storage: fakeStorage() });

  assert.equal(clientModel(), initialized);
  // Repeated access is the same aggregate and the same leaves.
  assert.equal(clientModel().workbench, initialized.workbench);
  assert.equal(clientModel().storage, initialized.storage);
});
