import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { clientModel, initClientModel } from "$model/client";
import { buildClientModel } from "$model/client/constructor";
import type { ClientStorage, PersistedWorkbench } from "$model/client/storage";

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
  const model = buildClientModel({ project: "alpha", storage: fakeStorage() });

  assert.equal(model.project, "alpha");
  assert.ok(model.storage);
  assert.ok(model.workbench);
});

test("the workbench is built over the storage the root was given", () => {
  const storage = fakeStorage();
  const model = buildClientModel({ project: "alpha", storage });

  model.workbench.open({ kind: "project-overview", id: "other" });

  // Not a second store: the object the root handed down is the one written to.
  assert.equal(model.storage, storage);
  assert.equal(storage.workbench?.tabs.length, 2);
});

test("stands a model up from a given starting state", () => {
  // The reason storage is a parameter: a whole configuration goes in as data,
  // rather than being assembled by calls a test has to keep in step.
  const model = buildClientModel({
    project: "alpha",
    storage: fakeStorage({
      tabs: [
        [
          "project-overview",
          "restored",
          {
            panels: {
              contextWidth: 320,
              contextCollapsed: true,
              inspectorWidth: 400,
              inspectorCollapsed: false
            }
          }
        ]
      ],
      active: ["project-overview", "restored"]
    })
  });

  assert.equal(model.workbench.active.resource.id, "restored");
  assert.equal(model.workbench.tabs.length, 2); // permanent + restored
  assert.equal(model.workbench.panels.contextWidth, 320);
  assert.equal(model.workbench.panels.contextCollapsed, true);
});

test("two models share nothing", () => {
  // The assertion the whole shape exists for, at the level a component sees.
  const a = buildClientModel({ project: "alpha", storage: fakeStorage() });
  const b = buildClientModel({ project: "beta", storage: fakeStorage() });

  a.workbench.open({ kind: "project-overview", id: "only-in-a" });
  a.workbench.resize({ contextWidth: 400 });
  a.workbench.inspect([{ kind: "empty" }]);

  assert.equal(b.workbench.tabs.length, 1);
  assert.equal(b.workbench.panels.contextWidth, 276);
  assert.equal(b.workbench.currentInspection, undefined);
  assert.notEqual(a.project, b.project);
  assert.notEqual(a.storage, b.storage);
  assert.notEqual(a.workbench, b.workbench);
});

test("one model's writes reach only its own storage", () => {
  const first = fakeStorage();
  const second = fakeStorage();

  buildClientModel({ project: "alpha", storage: first }).workbench.resize({
    inspectorWidth: 500
  });
  buildClientModel({ project: "beta", storage: second });

  assert.equal(first.workbench?.tabs[0][2]?.panels?.inspectorWidth, 500);
  assert.equal(second.workbench, undefined);
});

test("the initializer's graph is what the accessor returns", () => {
  const initialized = initClientModel({ project: "alpha", storage: fakeStorage() });

  assert.equal(clientModel(), initialized);
  // Repeated access is the same aggregate and the same leaves.
  assert.equal(clientModel().workbench, initialized.workbench);
  assert.equal(clientModel().storage, initialized.storage);
});
