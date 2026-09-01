import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const wire = vi.hoisted(() => ({
  row: null as unknown,
  sent: [] as { baseRevision: number; ops: unknown[]; activeId: string }[],
  refuse: false
}));

vi.mock("$capabilities/workspace/index.remote", () => ({
  readWorkspaceState: () => Promise.resolve(wire.row),
  submitWorkspaceChanges: (input: { baseRevision: number; ops: unknown[]; activeId: string }) => {
    wire.sent.push(input);
    return wire.refuse
      ? Promise.reject(new Error("refused"))
      : Promise.resolve({ revision: wire.sent.length });
  }
}));

const { createConfiguration } = await import("$model/client/configuration");
const { createTabList } = await import("$model/client/tab-list");
const { createTabViews } = await import("$model/client/tab-views");
const { createWorkspaceState } = await import("$model/client/workspace-state");

const thresholds = (flushAfterOps: number, flushAfterMs: number) =>
  createConfiguration({ workspace: { changeSets: { flushAfterOps, flushAfterMs } } });

const workspaceState = (afterOps = 3, afterMs = 60_000) =>
  createWorkspaceState("p1", createTabList(), createTabViews(), thresholds(afterOps, afterMs));

const document = (id: string) => ({ screen: "document-editor", resourceId: id }) as const;

const view = {
  subscreen: "workspace",
  focus: null,
  contextId: null,
  inspected: "empty",
  selection: null,
  frame: {
    contextWidth: 400,
    contextCollapsed: false,
    inspectorWidth: 320,
    inspectorCollapsed: true
  }
};

beforeEach(() => {
  wire.row = null;
  wire.sent.length = 0;
  wire.refuse = false;
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

test("a refused submit keeps its ops and says so", async () => {
  const model = workspaceState(1000, 60_000);
  wire.refuse = true;

  model.activate(model.tabs[1].id);
  await assert.rejects(() => model.flush());

  assert.equal(model.sync, "error");
  assert.equal(model.pending, 1, "unsent work is never dropped");

  wire.refuse = false;
  await model.flush();

  assert.equal(model.sync, "saved");
  assert.equal(model.pending, 0);
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
  wire.row = {
    revision: 12,
    tabs: [
      { id: "t1", screen: "project-overview" },
      { id: "t7", screen: "document-editor", resourceId: "k57" }
    ],
    activeId: "t7",
    views: { t1: view, t7: view }
  };

  const model = workspaceState();
  await model.restore();

  assert.deepEqual(
    model.tabs.map((tab) => tab.id),
    ["t1", "t7"]
  );
  assert.equal(model.activeId, "t7");
  assert.equal(model.active.resourceId, "k57");
  assert.equal(model.frame.contextWidth, 400);
  assert.equal(model.frame.inspectorCollapsed, true);
  assert.equal(model.revision, 12);
});

test("a restored id cannot be minted again", async () => {
  wire.row = {
    revision: 1,
    tabs: [{ id: "t7", screen: "project-overview" }],
    activeId: "t7",
    views: { t7: view }
  };

  const model = workspaceState();
  await model.restore();

  const opened = model.open(document("k57"));

  assert.notEqual(opened.id, "t7");
  assert.equal(model.tabs.filter((tab) => tab.id === opened.id).length, 1);
});

test("restoring does not overwrite what the person has already done", async () => {
  wire.row = {
    revision: 3,
    tabs: [{ id: "t1", screen: "project-overview" }],
    activeId: "t1",
    views: { t1: view }
  };

  const model = workspaceState();
  const opened = model.open(document("k57"));

  await model.restore();

  assert.equal(model.tabs.some((tab) => tab.id === opened.id), true);
  assert.equal(model.revision, 0);
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
