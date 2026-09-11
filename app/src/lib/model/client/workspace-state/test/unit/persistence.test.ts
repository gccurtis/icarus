import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { openingView } from "$representation/data/behavior/workspace/opening";
import type { TabRecord, TabView } from "$representation/data/types/workspace/tab";

const wire = vi.hoisted(() => ({
  row: null as unknown,
  sent: [] as { baseRevision: number; ops: unknown[] }[],
  fault: false,
  refusals: 0
}));

vi.mock("$capabilities/workspace/index.remote", () => ({
  readWorkspaceState: () => Promise.resolve(wire.row),
  submitWorkspaceChanges: ({
    changeSet
  }: {
    changeSet: { baseRevision: number; ops: unknown[] };
  }) => {
    wire.sent.push(changeSet);
    if (wire.fault) return Promise.reject(new Error("offline"));

    if (wire.refusals > 0) {
      wire.refusals -= 1;
      return Promise.resolve({
        accepted: false,
        reason: "conflict",
        revision: 40,
        detail: "tab:t1 moved"
      });
    }

    return Promise.resolve({ accepted: true, revision: wire.sent.length, merged: false });
  }
}));

const { createTabList } = await import("$model/client/tab-list");
const { createTabViews } = await import("$model/client/tab-views");
const { createWorkspaceState } = await import("$model/client/workspace-state");
const { startingWorkspace } = await import(
  "$model/client/workspace-state/methods/shared/defaults"
);

const thresholds = (flushAfterOps: number, flushAfterMs: number) =>
  ({ afterOps: flushAfterOps, afterMs: flushAfterMs });

const workspaceState = (afterOps = 3, afterMs = 60_000) =>
  createWorkspaceState("p1", createTabList(), createTabViews(), thresholds(afterOps, afterMs));

const document = (id: string) => ({
  category: "document-editor",
  resourceId: `documents:${id}`
}) as const;

const view = {
  content: "document-editor.document",
  focus: null,
  contextId: "document-editor.layout",
  inspected: "empty",
  selection: null,
  frame: {
    contextWidth: 400,
    contextCollapsed: false,
    inspectorWidth: 320,
    inspectorCollapsed: true
  },
  zoom: null
} satisfies TabView;

const currentWorkspace = (
  revision: number,
  addition?: { readonly tab: TabRecord; readonly view: TabView; readonly active?: boolean }
) => {
  const starting = startingWorkspace();
  return {
    revision,
    tabs: addition === undefined ? [...starting.tabs] : [...starting.tabs, addition.tab],
    activeId: addition?.active === true ? addition.tab.id : starting.activeId,
    views: addition === undefined
      ? { ...starting.views }
      : { ...starting.views, [addition.tab.id]: addition.view }
  };
};

beforeEach(() => {
  wire.row = null;
  wire.sent.length = 0;
  wire.fault = false;
  wire.refusals = 0;
});

test("nothing leaves while both thresholds are unmet", async () => {
  const model = workspaceState();

  model.activate(model.tabs[1].id);

  assert.deepEqual(wire.sent, []);
  assert.equal(model.pending, 1);
});

test("reaching the op count submits every buffered op as one change set", async () => {
  const model = workspaceState(3);

  model.open(document("k57"));
  model.resize({ contextWidth: 400 });
  await model.flush();

  assert.equal(wire.sent.length, 1, "one change set, not one per op");
  assert.equal(wire.sent[0].ops.length, 3, "the open, the move to it, and the drag");
  assert.equal(wire.sent[0].baseRevision, 0);
  assert.equal(model.pending, 0);
  assert.equal(model.revision, 1);
  assert.equal(model.sync, "saved");
});

test("resource-less open and close ops omit the optional resource id", async () => {
  const model = workspaceState(1000, 60_000);

  const opened = model.open({ category: "new-tab" });
  await model.flush();

  const opening = wire.sent[0].ops.find(
    (op) => typeof op === "object" && op !== null && "op" in op && op.op === "open"
  ) as { target: Record<string, unknown> };
  assert.equal(Object.hasOwn(opening.target, "resourceId"), false);

  model.close(opened.id);
  await model.flush();

  const closing = wire.sent[1].ops.find(
    (op) => typeof op === "object" && op !== null && "op" in op && op.op === "close"
  ) as { target: Record<string, unknown> };
  assert.equal(Object.hasOwn(closing.target, "resourceId"), false);
});

test("inspection ops omit absent optional selection fields", async () => {
  const model = workspaceState(1000, 60_000);

  model.inspect("templates.template", {
    kind: "template",
    id: "templates:1",
    at: undefined,
    ranges: undefined,
    ids: undefined
  });
  await model.flush();

  const inspection = wire.sent[0].ops.find(
    (op) => typeof op === "object" && op !== null && "op" in op && op.op === "inspect"
  ) as { selection: Record<string, unknown> };
  assert.equal(Object.hasOwn(inspection.selection, "at"), false);
  assert.equal(Object.hasOwn(inspection.selection, "ranges"), false);
  assert.equal(Object.hasOwn(inspection.selection, "ids"), false);
});

test("inspection ops persist every document selection range", async () => {
  const model = workspaceState(1000, 60_000);
  const multiple = {
    kind: "text-selection",
    id: "block-1/atoms/atom-1@1",
    at: "block-2/atoms/atom-2@4",
    ranges: [
      { id: "block-3/atoms/atom-3@2", at: "block-3/atoms/atom-3@7" },
      { id: "block-4/atoms/atom-4@0", at: "block-5/atoms/atom-5@3" }
    ]
  };

  model.inspect("document-editor.text-selection", multiple);
  await model.flush();

  const inspection = wire.sent[0].ops.find(
    (op) => typeof op === "object" && op !== null && "op" in op && op.op === "inspect"
  ) as { selection: Record<string, unknown> };
  assert.deepEqual(inspection.selection, multiple);
});

test("inspection ops persist every member of a multi-selection", async () => {
  const model = workspaceState(1000, 60_000);
  const multiple = {
    kind: "elements",
    id: "element-1",
    ids: ["element-1", "element-2"]
  };

  model.inspect("presentation-editor.multi-selection", multiple);
  await model.flush();

  const inspection = wire.sent[0].ops.find(
    (op) => typeof op === "object" && op !== null && "op" in op && op.op === "inspect"
  ) as { selection: Record<string, unknown> };
  assert.deepEqual(inspection.selection, multiple);
});

test("the debounce submits what the count never reached", async () => {
  const model = workspaceState(1000, 5);

  model.activate(model.tabs[1].id);
  assert.deepEqual(wire.sent, []);

  await new Promise((settle) => setTimeout(settle, 30));

  assert.equal(wire.sent.length, 1);
  assert.equal(model.pending, 0);
});

test("flush submits immediately and joins a submit already out", async () => {
  const model = workspaceState(1000, 60_000);

  model.activate(model.tabs[1].id);
  await Promise.all([model.flush(), model.flush()]);

  assert.equal(wire.sent.length, 1, "two flushes are one write");
});

test("flush with nothing buffered writes nothing", async () => {
  const model = workspaceState();

  await model.flush();

  assert.deepEqual(wire.sent, []);
});

test("a fault keeps its ops and says so", async () => {
  const model = workspaceState(1000, 60_000);
  wire.fault = true;

  model.activate(model.tabs[1].id);
  await assert.rejects(() => model.flush());

  assert.equal(model.sync, "error");
  assert.equal(model.pending, 1, "unsent work is never dropped");

  wire.fault = false;
  await model.flush();

  assert.equal(model.sync, "saved");
  assert.equal(model.pending, 0);
});

test("a refusal is re-stated against what the server holds and resubmitted", async () => {
  wire.row = currentWorkspace(40);
  wire.refusals = 1;

  const model = workspaceState(1000, 60_000);
  model.activate(model.tabs[1].id);

  await model.flush();

  assert.equal(wire.sent.length, 2, "refused once, resubmitted once");
  assert.equal(wire.sent[0].baseRevision, 0);
  assert.equal(wire.sent[1].baseRevision, 40, "the retry is stated against the adopted revision");
  assert.equal(model.sync, "saved");
});

test("a refusal the rebase cannot resolve adopts the strict current server workspace", async () => {
  wire.row = currentWorkspace(40);
  wire.refusals = 2;

  const model = workspaceState(1000, 60_000);
  model.activate(model.tabs[1].id);

  await model.flush();

  assert.equal(model.sync, "needs-review");
  assert.deepEqual(
    model.tabs.map((tab) => tab.id),
    startingWorkspace().tabs.map((tab) => tab.id)
  );
  assert.equal(model.revision, 40);
});

test("the base revision follows what the server last accepted", async () => {
  const model = workspaceState(1000, 60_000);

  model.activate(model.tabs[1].id);
  await model.flush();
  model.activate(model.tabs[2].id);
  await model.flush();

  assert.deepEqual(
    wire.sent.map((change) => change.baseRevision),
    [0, 1]
  );
});

test("a first visit lands on the singletons", async () => {
  const model = workspaceState();
  const before = model.tabs.map((tab) => tab.id);

  await model.restore();

  assert.deepEqual(
    model.tabs.map((tab) => tab.id),
    before
  );
  assert.equal(model.sync, "saved");
  assert.equal(model.revision, 0);
});

test("a stored row comes back whole — the tabs, the widths and the tab that was in front", async () => {
  wire.row = currentWorkspace(12, {
    tab: { id: "t7", category: "document-editor", resourceId: "documents:k57" },
    view,
    active: true
  });

  const model = workspaceState();
  await model.restore();

  assert.deepEqual(
    model.tabs.map((tab) => tab.id),
    [...startingWorkspace().tabs.map((tab) => tab.id), "t7"]
  );
  assert.equal(model.activeId, "t7");
  assert.equal(model.active.resourceId, "documents:k57");
  assert.equal(model.frame.contextWidth, 400);
  assert.equal(model.frame.inspectorCollapsed, true);
  assert.equal(model.revision, 12);
});

test("a restored id cannot be minted again", async () => {
  wire.row = currentWorkspace(1, {
    tab: { id: "t7", category: "new-tab" },
    view: openingView("new-tab")
  });

  const model = workspaceState();
  await model.restore();

  const opened = model.open(document("k57"));

  assert.notEqual(opened.id, "t7");
  assert.equal(model.tabs.filter((tab) => tab.id === opened.id).length, 1);
});

test("restoring does not overwrite what the person has already done", async () => {
  wire.row = currentWorkspace(3);

  const model = workspaceState();
  const opened = model.open(document("k57"));

  await model.restore();

  assert.equal(model.tabs.some((tab) => tab.id === opened.id), true);
  assert.equal(model.revision, 0);
});

test("a malformed present snapshot is rejected whole before live state changes", async () => {
  const exact = currentWorkspace(9);
  const { external: _missing, ...missingView } = exact.views;
  const hostile = [
    { ...exact, revision: -1 },
    { ...exact, activeId: "retired-tab" },
    { ...exact, views: missingView },
    { ...exact, workbench: { tabs: [] } }
  ];

  for (const row of hostile) {
    wire.row = row;
    const model = workspaceState();
    const before = model.tabs.map((tab) => tab.id);

    await assert.rejects(
      model.restore(),
      /did not return one exact current workspace state/
    );

    assert.deepEqual(model.tabs.map((tab) => tab.id), before);
    assert.equal(model.activeId, startingWorkspace().activeId);
    assert.equal(model.revision, 0);
    assert.equal(model.sync, "loading");
  }
});

test("zero thresholds buffer nothing and submit nothing", async () => {
  const model = workspaceState(0, 0);

  model.open(document("k57"));
  model.resize({ contextWidth: 400 });
  await model.restore();
  await model.flush();

  assert.deepEqual(wire.sent, []);
  assert.equal(model.pending, 0);
  assert.equal(model.canUndo, true, "it still records what it did, it just tells nobody");
});
