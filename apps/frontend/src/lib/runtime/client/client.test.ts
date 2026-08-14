import assert from "node:assert/strict";
import { test } from "vitest";
import { createClientRuntime } from "$runtime/client";
import type {
  ClientStorage,
  PersistedPreferences,
  PersistedWorkbench
} from "$runtime/client/storage";

/**
 * What the composition root is for.
 *
 * Each object can be built alone, and its own tests do that. This file tests
 * what only the assembled graph can show: that the projections follow the
 * workbench, and that a whole runtime can be stood up from a given starting
 * state in one call. Wiring five objects by hand in every test would make that
 * setup the thing most likely to be wrong.
 */

const fakeStorage = (initial: Partial<ClientStorage> = {}): ClientStorage => {
  let preferences = initial.preferences;
  let workbench = initial.workbench;
  return {
    get preferences() {
      return preferences;
    },
    get workbench() {
      return workbench;
    },
    savePreferences: (value: PersistedPreferences) => (preferences = value),
    saveWorkbench: (value: PersistedWorkbench) => (workbench = value)
  };
};

test("builds the whole graph over one storage", () => {
  const runtime = createClientRuntime(fakeStorage());

  assert.ok(runtime.storage);
  assert.ok(runtime.preferences);
  assert.ok(runtime.workbench);
  assert.ok(runtime.activities);
  assert.ok(runtime.inspector);
});

test("the projections read through the same workbench they were built over", () => {
  const runtime = createClientRuntime(fakeStorage());

  // Nothing inspected yet, and the rail sits on the kind's default.
  assert.equal(runtime.inspector.current, undefined);
  assert.equal(runtime.activities.active.id, "overview");

  runtime.inspector.inspect([{ kind: "empty" }]);

  // The inspector wrote to the workbench's active tab, and reads it back —
  // neither object holds the inspection itself.
  assert.deepEqual(runtime.workbench.active.options.inspection, [{ kind: "empty" }]);
  assert.deepEqual(runtime.inspector.current, { kind: "empty" });
});

test("an inspection follows the tab it was made on", () => {
  const runtime = createClientRuntime(fakeStorage());
  const overview = runtime.workbench.active;

  runtime.inspector.inspect([{ kind: "empty" }]);
  const other = runtime.workbench.open({ kind: "project-overview", id: "other" });

  // A fresh tab has its own inspection — which is to say, none.
  assert.equal(runtime.inspector.current, undefined);

  runtime.workbench.activate(overview.id);
  assert.deepEqual(runtime.inspector.current, { kind: "empty" });

  runtime.workbench.activate(other.id);
  assert.equal(runtime.inspector.current, undefined);
});

test("selecting an activity records it on the active tab, not globally", () => {
  const runtime = createClientRuntime(fakeStorage());
  const overview = runtime.workbench.active;
  const other = runtime.workbench.open({ kind: "project-overview", id: "other" });

  runtime.activities.select("overview");
  assert.equal(other.options.activityId, "overview");
  assert.equal(overview.options.activityId, undefined);
});

test("stands a runtime up from a given starting state", () => {
  // The reason storage is a parameter: a whole configuration goes in as data,
  // rather than being assembled by five calls a test has to keep in step.
  const runtime = createClientRuntime(
    fakeStorage({
      preferences: {
        contextWidth: 320,
        contextCollapsed: true,
        inspectorWidth: 400,
        inspectorCollapsed: false
      },
      workbench: {
        tabs: [["project-overview", "restored"]],
        active: ["project-overview", "restored"]
      }
    })
  );

  assert.equal(runtime.preferences.panels.contextWidth, 320);
  assert.equal(runtime.preferences.panels.contextCollapsed, true);
  assert.equal(runtime.workbench.active.resource.id, "restored");
  assert.equal(runtime.workbench.tabs.length, 2); // permanent + restored
});

test("two runtimes share nothing", () => {
  // The assertion the whole refactor exists for, at the level a component sees.
  const a = createClientRuntime(fakeStorage());
  const b = createClientRuntime(fakeStorage());

  a.workbench.open({ kind: "project-overview", id: "only-in-a" });
  a.preferences.set({ contextWidth: 400 });
  a.inspector.inspect([{ kind: "empty" }]);

  assert.equal(b.workbench.tabs.length, 1);
  assert.equal(b.preferences.panels.contextWidth, 276);
  assert.equal(b.inspector.current, undefined);
});

test("one runtime's writes reach only its own storage", () => {
  const first = fakeStorage();
  const second = fakeStorage();

  createClientRuntime(first).preferences.set({ inspectorWidth: 500 });
  createClientRuntime(second);

  assert.equal(first.preferences?.inspectorWidth, 500);
  assert.equal(second.preferences, undefined);
});
