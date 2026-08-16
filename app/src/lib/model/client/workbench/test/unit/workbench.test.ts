import assert from "node:assert/strict";
import { test } from "vitest";
import type { ClientStorage, PersistedPanels, PersistedWorkbench } from "$model/client/storage";
import type { ActivityId } from "$model/client/workbench";
import { DEFAULTS, PROJECT_OVERVIEW, createWorkbench } from "$model/client/workbench";

/**
 * The invariants here were guaranteed only by prose before this object moved — a
 * permanent tab cannot be closed, `activeId` is never empty, closing the active
 * tab selects right-then-left. A refactor that broke one would have gone
 * unnoticed until a surface rendered it.
 *
 * Three surfaces fold in here: the rail, the inspector, and panel geometry. What
 * used to be tested across four objects is tested through one, and the questions
 * are the same ones — does the value follow the active tab, and does writing on
 * one tab leave the others alone.
 */

/** Storage that keeps what it is given, so restore can be exercised. */
const fakeStorage = (initial?: PersistedWorkbench): ClientStorage => {
  let workbench = initial;
  return {
    get workbench() {
      return workbench;
    },
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

// ---------------------------------------------------------------- rail ----

test("the rail sits on the kind's default until a tab chooses", () => {
  const workbench = createWorkbench(fakeStorage());

  assert.deepEqual(workbench.availableActivities, ["overview"]);
  assert.equal(workbench.activeActivity, "overview");
});

test("selecting an activity records it on the active tab, not globally", () => {
  const workbench = createWorkbench(fakeStorage());
  const overview = workbench.active;
  const other = workbench.open(OTHER);

  workbench.selectActivity("overview");

  assert.equal(other.options.activityId, "overview");
  assert.equal(overview.options.activityId, undefined);
});

test("an activity the kind does not offer is refused", () => {
  const workbench = createWorkbench(fakeStorage());

  // The rail can only have rendered what is available, so anything else is a
  // caller defect rather than drift.
  assert.throws(
    () => workbench.selectActivity("not-an-activity" as unknown as ActivityId),
    /not available/
  );
});

// ----------------------------------------------------------- inspector ----

test("an inspection is written to and read back from the active tab", () => {
  const workbench = createWorkbench(fakeStorage());

  assert.equal(workbench.currentInspection, undefined);

  workbench.inspect([{ kind: "empty" }]);

  // The inspection lives on the tab; `currentInspection` is the innermost node.
  assert.deepEqual(workbench.active.options.inspection, [{ kind: "empty" }]);
  assert.deepEqual(workbench.currentInspection, { kind: "empty" });
});

test("currentInspection is the innermost node of the ancestry", () => {
  const workbench = createWorkbench(fakeStorage());

  workbench.inspect([{ kind: "empty" }, { kind: "document-table", tableId: "t1" }]);

  assert.deepEqual(workbench.currentInspection, { kind: "document-table", tableId: "t1" });
});

test("an inspection follows the tab it was made on", () => {
  const workbench = createWorkbench(fakeStorage());
  const overview = workbench.active;

  workbench.inspect([{ kind: "empty" }]);
  const other = workbench.open(OTHER);

  // A fresh tab has its own inspection — which is to say, none.
  assert.equal(workbench.currentInspection, undefined);

  workbench.activate(overview.id);
  assert.deepEqual(workbench.currentInspection, { kind: "empty" });

  workbench.activate(other.id);
  assert.equal(workbench.currentInspection, undefined);
});

test("clearing an inspection leaves nothing inspected", () => {
  const workbench = createWorkbench(fakeStorage());

  workbench.inspect([{ kind: "empty" }]);
  workbench.inspect();

  assert.equal(workbench.currentInspection, undefined);
});

// -------------------------------------------------------------- panels ----

test("panels falls back to the defaults until a tab is resized", () => {
  const workbench = createWorkbench(fakeStorage());

  assert.deepEqual(workbench.panels, DEFAULTS);
  // A tab nobody dragged stores nothing of its own.
  assert.equal(workbench.active.options.panels, undefined);
});

test("panel geometry follows the active tab", () => {
  const workbench = createWorkbench(fakeStorage());
  const overview = workbench.active;
  const other = workbench.open(OTHER);

  workbench.resize({ contextWidth: 400 });
  assert.equal(workbench.panels.contextWidth, 400);

  workbench.activate(overview.id);
  assert.equal(workbench.panels.contextWidth, DEFAULTS.contextWidth);

  workbench.activate(other.id);
  assert.equal(workbench.panels.contextWidth, 400);
});

test("resizing one tab leaves another unchanged", () => {
  const workbench = createWorkbench(fakeStorage());
  const overview = workbench.active;
  const other = workbench.open(OTHER);

  workbench.resize({ inspectorWidth: 500 });

  assert.equal(other.options.panels?.inspectorWidth, 500);
  assert.equal(overview.options.panels, undefined);
});

test("a resize patches one dimension and leaves the rest at their defaults", () => {
  const workbench = createWorkbench(fakeStorage());

  workbench.resize({ contextCollapsed: true });

  assert.equal(workbench.panels.contextCollapsed, true);
  assert.equal(workbench.panels.contextWidth, DEFAULTS.contextWidth);
  assert.equal(workbench.panels.inspectorWidth, DEFAULTS.inspectorWidth);
});

test("resizing cannot reach the frozen defaults", () => {
  // Without the spread in `resize`, the frozen constant itself would land on the
  // tab and a later write would reach every other tab reading it. The freeze
  // makes that throw rather than leak.
  const workbench = createWorkbench(fakeStorage());
  workbench.resize({ contextWidth: 400 });

  const fresh = createWorkbench(fakeStorage());
  assert.equal(fresh.panels.contextWidth, DEFAULTS.contextWidth);
  assert.equal(DEFAULTS.contextWidth, 276);
});

// ------------------------------------------------------------- restore ----

test("restores stored tabs and the active one", () => {
  const workbench = createWorkbench(
    fakeStorage({
      tabs: [
        ["project-overview", "a"],
        ["project-overview", "b"]
      ],
      active: ["project-overview", "b"]
    })
  );

  assert.equal(workbench.tabs.length, 3); // permanent + two
  assert.equal(workbench.active.resource.id, "b");
});

test("stands a workbench up from a given starting state", () => {
  // The reason storage is a parameter: a whole configuration goes in as data,
  // rather than being assembled by calls a test has to keep in step.
  const workbench = createWorkbench(
    fakeStorage({
      tabs: [
        [
          "project-overview",
          "restored",
          {
            activityId: "overview",
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
  );

  assert.equal(workbench.tabs.length, 2); // permanent + restored
  assert.equal(workbench.active.resource.id, "restored");
  assert.equal(workbench.activeActivity, "overview");
  assert.equal(workbench.panels.contextWidth, 320);
  assert.equal(workbench.panels.contextCollapsed, true);
});

test("drops a stored tab whose kind no longer exists", () => {
  // ACTIVITIES_BY_KIND is keyed by kind, so an unknown one resolves to undefined
  // and throws during paint. Dropping it is what keeps a stale store from being
  // a crash.
  const workbench = createWorkbench(
    fakeStorage({
      tabs: [
        ["a-kind-that-no-longer-exists", "x"],
        ["project-overview", "a"]
      ]
    })
  );

  assert.equal(workbench.tabs.length, 2);
  assert.ok(workbench.tabs.every((tab) => tab.resource.kind === "project-overview"));
});

test("drops a stored activity id the kind no longer offers", () => {
  // A reset rail is a harmless outcome where a crash is not.
  const workbench = createWorkbench(
    fakeStorage({ tabs: [["project-overview", "a", { activityId: "gone" }]] })
  );

  assert.equal(workbench.active.options.activityId, undefined);
  assert.equal(workbench.activeActivity, "overview");
});

test("merges stored geometry over the defaults", () => {
  // A field added to Panels after a document was written still has a value on
  // the first load after it ships.
  const workbench = createWorkbench(
    fakeStorage({
      tabs: [["project-overview", "a", { panels: { contextWidth: 300 } as PersistedPanels }]]
    })
  );

  assert.equal(workbench.panels.contextWidth, 300);
  assert.equal(workbench.panels.inspectorWidth, DEFAULTS.inspectorWidth);
});

test("a stored duplicate of the permanent tab does not appear twice", () => {
  const workbench = createWorkbench(
    fakeStorage({ tabs: [["project-overview", "project-overview"]] })
  );

  assert.equal(workbench.tabs.length, 1);
  assert.equal(workbench.tabs[0].permanent, true);
});

test("the permanent tab's own geometry survives a reload", () => {
  // It is reconstructed rather than restored, but the geometry a user dragged on
  // it would otherwise be the one panel size a reload forgot.
  const storage = fakeStorage();
  createWorkbench(storage).resize({ contextWidth: 380 });

  const reloaded = createWorkbench(fakeStorage(storage.workbench));

  assert.equal(reloaded.tabs.length, 1);
  assert.equal(reloaded.tabs[0].permanent, true);
  assert.equal(reloaded.panels.contextWidth, 380);
});

test("an active ref matching nothing leaves a valid active tab", () => {
  const workbench = createWorkbench(
    fakeStorage({
      tabs: [["project-overview", "a"]],
      active: ["project-overview", "gone"]
    })
  );

  assert.ok(workbench.tabs.some((tab) => tab.id === workbench.activeId));
});

test("restored tabs get fresh ids rather than stored ones", () => {
  const workbench = createWorkbench(fakeStorage({ tabs: [["project-overview", "a"]] }));

  // Ids are minted by an instance counter. Two tabs, two distinct ids.
  const ids = workbench.tabs.map((tab) => tab.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("persists every tab as a ref, and only the options that outlive it", () => {
  const storage = fakeStorage();
  const workbench = createWorkbench(storage);

  workbench.open(OTHER);
  workbench.inspect([{ kind: "empty" }]);

  assert.deepEqual(storage.workbench?.tabs, [
    ["project-overview", "project-overview"],
    ["project-overview", "other"]
  ]);
  assert.deepEqual(storage.workbench?.active, ["project-overview", "other"]);
});

test("an inspection is never written to storage", () => {
  const storage = fakeStorage();
  const workbench = createWorkbench(storage);

  // Open first, so there is a written document for an inspection to leak into.
  workbench.open(OTHER);
  workbench.inspect([{ kind: "document-table", tableId: "t1" }]);

  // It names block ids in a document that may have changed since, and persisting
  // it would mean a write per keystroke-adjacent action.
  assert.equal(storage.workbench?.tabs.length, 2);
  assert.equal(storage.workbench?.tabs[1][2], undefined);
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

test("two workbenches share no panel geometry", () => {
  const a = createWorkbench(fakeStorage());
  const b = createWorkbench(fakeStorage());

  a.resize({ contextWidth: 400 });

  assert.equal(a.panels.contextWidth, 400);
  assert.equal(b.panels.contextWidth, DEFAULTS.contextWidth, "b saw a's width");
});

test("one workbench's writes reach only its own storage", () => {
  const first = fakeStorage();
  const second = fakeStorage();

  createWorkbench(first).resize({ inspectorWidth: 500 });
  createWorkbench(second);

  assert.equal(first.workbench?.tabs[0][2]?.panels?.inspectorWidth, 500);
  assert.equal(second.workbench?.tabs[0][2], undefined);
});
