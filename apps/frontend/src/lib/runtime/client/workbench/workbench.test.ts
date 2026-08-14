import assert from "node:assert/strict";
import { test } from "vitest";
import type { ClientStorage, PersistedPreferences, PersistedWorkbench } from "$runtime/client/storage";
import { createPreferences } from "$runtime/client/preferences";
import { createWorkbench } from "$runtime/client/workbench";
import { PROJECT_OVERVIEW } from "$runtime/client/workbench/types";

/**
 * The invariants here were guaranteed only by prose before this move — a
 * permanent tab cannot be closed, `activeId` is never empty, closing the active
 * tab selects right-then-left. A refactor that broke one would have gone
 * unnoticed until the shell was wired.
 */

/** Storage that keeps what it is given, so restore can be exercised. */
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

const OTHER = { kind: "project-overview", id: "other" } as const;
const THIRD = { kind: "project-overview", id: "third" } as const;

test("starts with the permanent tab active", () => {
  const workbench = createWorkbench(fakeStorage());

  assert.equal(workbench.tabs.length, 1);
  assert.equal(workbench.tabs[0].permanent, true);
  assert.equal(workbench.activeId, workbench.tabs[0].id);
  assert.deepEqual(workbench.active.resource, PROJECT_OVERVIEW);
});

test("opening the same resource twice returns the same tab", () => {
  const workbench = createWorkbench(fakeStorage());

  const first = workbench.open(OTHER);
  const second = workbench.open(OTHER);

  assert.equal(first, second);
  assert.equal(workbench.tabs.length, 2);
});

test("a permanent tab cannot be closed", () => {
  const workbench = createWorkbench(fakeStorage());

  assert.throws(() => workbench.close(workbench.tabs[0].id), /permanent/);
  assert.equal(workbench.tabs.length, 1);
});

test("a permanent tab cannot be reordered", () => {
  const workbench = createWorkbench(fakeStorage());
  workbench.open(OTHER);

  assert.throws(() => workbench.reorder(workbench.tabs[0].id, 1), /permanent/);
});

test("closing the active tab selects the one to its right", () => {
  const workbench = createWorkbench(fakeStorage());
  const second = workbench.open(OTHER);
  const third = workbench.open(THIRD);

  workbench.activate(second.id);
  workbench.close(second.id);

  assert.equal(workbench.activeId, third.id);
});

test("closing the rightmost active tab falls back to the left", () => {
  const workbench = createWorkbench(fakeStorage());
  const second = workbench.open(OTHER);
  const third = workbench.open(THIRD);

  workbench.close(third.id);

  assert.equal(workbench.activeId, second.id);
});

test("activeId is never empty, even after closing everything closeable", () => {
  const workbench = createWorkbench(fakeStorage());
  workbench.open(OTHER);
  workbench.open(THIRD);

  for (const tab of [...workbench.tabs].filter((t) => !t.permanent)) {
    workbench.close(tab.id);
  }

  assert.equal(workbench.tabs.length, 1);
  assert.ok(workbench.activeId);
  assert.equal(workbench.active.permanent, true);
});

test("reorder clamps an overshooting drag rather than throwing", () => {
  const workbench = createWorkbench(fakeStorage());
  const second = workbench.open(OTHER);
  workbench.open(THIRD);

  // A drag past the end is an ordinary gesture, not a caller error.
  assert.doesNotThrow(() => workbench.reorder(second.id, 99));
  assert.equal(workbench.tabs.at(-1)?.id, second.id);

  assert.doesNotThrow(() => workbench.reorder(second.id, -5));
  // Index 0 among transient tabs is position 1 overall — behind the permanent one.
  assert.equal(workbench.tabs[1].id, second.id);
});

test("unknown ids are rejected rather than ignored", () => {
  const workbench = createWorkbench(fakeStorage());

  assert.throws(() => workbench.close("nope"), /unknown/);
  assert.throws(() => workbench.activate("nope"), /unknown/);
  assert.throws(() => workbench.reorder("nope", 0), /unknown/);
  assert.throws(() => workbench.update("nope", {}), /unknown/);
});

// ------------------------------------------------------------- restore ----

test("restores stored tabs and the active one", () => {
  const workbench = createWorkbench(
    fakeStorage({
      workbench: {
        tabs: [
          ["project-overview", "a"],
          ["project-overview", "b"]
        ],
        active: ["project-overview", "b"]
      }
    })
  );

  assert.equal(workbench.tabs.length, 3); // permanent + two
  assert.equal(workbench.active.resource.id, "b");
});

test("drops a stored tab whose kind no longer exists", () => {
  // ACTIVITIES is keyed by kind, so an unknown one resolves to undefined and
  // throws during paint. Dropping it is what keeps a stale store from being a
  // crash.
  const workbench = createWorkbench(
    fakeStorage({
      workbench: {
        tabs: [
          ["a-kind-that-no-longer-exists", "x"],
          ["project-overview", "a"]
        ]
      }
    })
  );

  assert.equal(workbench.tabs.length, 2);
  assert.ok(workbench.tabs.every((tab) => tab.resource.kind === "project-overview"));
});

test("a stored duplicate of the permanent tab does not appear twice", () => {
  const workbench = createWorkbench(
    fakeStorage({
      workbench: { tabs: [["project-overview", "project-overview"]] }
    })
  );

  assert.equal(workbench.tabs.length, 1);
  assert.equal(workbench.tabs[0].permanent, true);
});

test("an active ref matching nothing leaves a valid active tab", () => {
  const workbench = createWorkbench(
    fakeStorage({
      workbench: {
        tabs: [["project-overview", "a"]],
        active: ["project-overview", "gone"]
      }
    })
  );

  assert.ok(workbench.tabs.some((tab) => tab.id === workbench.activeId));
});

test("restored tabs get fresh ids rather than stored ones", () => {
  const workbench = createWorkbench(
    fakeStorage({ workbench: { tabs: [["project-overview", "a"]] } })
  );

  // Ids are minted by an instance counter. Two tabs, two distinct ids, and the
  // permanent one still holds the first.
  const ids = workbench.tabs.map((tab) => tab.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("persists transient tabs but not the permanent one", () => {
  const storage = fakeStorage();
  const workbench = createWorkbench(storage);

  workbench.open(OTHER);

  assert.deepEqual(storage.workbench?.tabs, [["project-overview", "other"]]);
  assert.deepEqual(storage.workbench?.active, ["project-overview", "other"]);
});

// ----------------------------------------------------------- isolation ----

test("two workbenches share no state", () => {
  // The assertion this whole refactor exists for. Before it, one module-level
  // instance served every request in the process.
  const a = createWorkbench(fakeStorage());
  const b = createWorkbench(fakeStorage());

  a.open(OTHER);

  assert.equal(a.tabs.length, 2);
  assert.equal(b.tabs.length, 1, "b saw a's tab");
  assert.notEqual(a.activeId, b.activeId, "both minted the same id");
});

test("two preferences share no state", () => {
  const a = createPreferences(fakeStorage());
  const b = createPreferences(fakeStorage());

  a.set({ contextWidth: 400 });

  assert.equal(a.panels.contextWidth, 400);
  assert.equal(b.panels.contextWidth, 276, "b saw a's width");
});

test("mutating panels cannot reach the frozen defaults", () => {
  // Without the spread in the constructor, $state would proxy DEFAULTS itself
  // and this write would reach every later reader. The freeze makes that throw.
  const a = createPreferences(fakeStorage());
  a.set({ contextWidth: 400 });

  const b = createPreferences(fakeStorage());
  assert.equal(b.panels.contextWidth, 276);
});
