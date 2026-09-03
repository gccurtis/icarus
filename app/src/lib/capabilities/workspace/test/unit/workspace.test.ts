import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  tables: { workspaceSnapshots: [] as Row[], workspaceRevisions: [] as Row[] },
  store: {
    create: (table: "workspaceSnapshots" | "workspaceRevisions", fields: unknown) => {
      model.calls.push(`create ${table}`);
      const held = model.tables[table];
      const id = `${table}:${held.length + 1}`;
      held.push({ ...(fields as Row), _id: id });
      return id;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      const table = path as "workspaceSnapshots" | "workspaceRevisions";
      return { table, kind: "table", rows: model.tables[table] ?? [] };
    },
    update: (path: string, value: unknown) => {
      model.calls.push(`update ${path}`);
      const [table, id] = path.split(".") as ["workspaceSnapshots" | "workspaceRevisions", string];
      model.tables[table] = model.tables[table].map((row) =>
        row._id === id ? { ...(value as Row), _id: id } : row
      );
    },
    remove: (path: string) => model.calls.push(`remove ${path}`)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "u", username: "You" })
}));

const { readWorkspaceState } = await import(
  "$capabilities/workspace/api/read-workspace-state/read-workspace-state"
);
const { submitWorkspaceChanges } = await import(
  "$capabilities/workspace/api/submit-workspace-changes/submit-workspace-changes"
);

const view = {
  content: "project-overview.overview",
  focus: null,
  contextId: null,
  inspected: "empty",
  selection: null,
  frame: {
    contextWidth: 276,
    contextCollapsed: false,
    inspectorWidth: 320,
    inspectorCollapsed: false
  },
  zoom: 100
};

const opening = (tab: string, resourceId?: string) => ({
  op: "open",
  tab,
  at: 0,
  target: { category: "project-overview", ...(resourceId === undefined ? {} : { resourceId }) },
  view
});

const sending = (baseRevision: number, ops: unknown[]) => ({ changeSet: { baseRevision, ops } });

const snapshots = () => model.tables.workspaceSnapshots;

beforeEach(() => {
  model.calls.length = 0;
  model.tables.workspaceSnapshots.length = 0;
  model.tables.workspaceRevisions.length = 0;
});

describe("reading", () => {
  it("answers nothing on a first visit", async () => {
    assert.equal(await readWorkspaceState(), null);
  });

  it("answers this scope's row and no other", async () => {
    snapshots().push(
      { _id: "workspaceSnapshots:1", projectId: "other", userId: "u", revision: 9, tabs: [], activeId: "t9", views: {} },
      { _id: "workspaceSnapshots:2", projectId: "p", userId: "other", revision: 8, tabs: [], activeId: "t8", views: {} },
      { _id: "workspaceSnapshots:3", projectId: "p", userId: "u", revision: 7, tabs: [], activeId: "t7", views: {} }
    );

    const found = await readWorkspaceState();

    assert.equal(found?.revision, 7);
    assert.equal(found?.activeId, "t7");
  });

  it("hands back no key, because a caller could not have asked for another one", async () => {
    snapshots().push({
      _id: "workspaceSnapshots:1",
      projectId: "p",
      userId: "u",
      revision: 1,
      tabs: [],
      activeId: "t1",
      views: {}
    });

    const found = await readWorkspaceState();

    assert.deepEqual(Object.keys(found ?? {}).sort(), ["activeId", "revision", "tabs", "views"]);
  });
});

describe("submitting", () => {
  it("refuses an envelope it cannot act on", async () => {
    await expect(submitWorkspaceChanges("nope")).rejects.toThrow(/an input is an object/);
    await expect(submitWorkspaceChanges({})).rejects.toThrow(/changeSet is required/);
    await expect(submitWorkspaceChanges(sending(0, []))).rejects.toThrow(/at least one op/);
    await expect(submitWorkspaceChanges(sending(-1, [opening("t1")]))).rejects.toThrow(
      /revision number/
    );
    await expect(submitWorkspaceChanges(sending(0, [{ op: "teleport" }]))).rejects.toThrow(
      /names one of the workspace operations/
    );
  });

  it("does not reach the store when it refuses", async () => {
    await expect(submitWorkspaceChanges({})).rejects.toThrow();
    assert.deepEqual(model.calls, []);
  });

  it("an empty workspace starts on the singletons rather than on nothing", async () => {
    await submitWorkspaceChanges(sending(0, [{ op: "activate", was: "agents", now: "agents" }]));

    assert.deepEqual(
      (snapshots()[0].tabs as Row[]).map((tab) => tab.id),
      ["project-overview", "agents", "templates"]
    );
  });

  it("applies the ops itself rather than storing a snapshot the client sent", async () => {
    const answer = await submitWorkspaceChanges(sending(0, [opening("t1", "k57")]));

    assert.deepEqual(answer, { accepted: true, revision: 1, merged: false });
    assert.deepEqual((snapshots()[0].tabs as Row[])[0], {
      id: "t1",
      category: "project-overview",
      resourceId: "k57"
    });
  });

  it("a tab with no resource carries no key for one", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));

    const opened = (snapshots()[0].tabs as Row[]).find((tab) => tab.id === "t1");

    assert.deepEqual(opened, { id: "t1", category: "project-overview" });
    assert.equal("resourceId" in (opened ?? {}), false);
  });

  it("replaces the one row rather than adding a second", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));
    model.calls.length = 0;

    const answer = await submitWorkspaceChanges(sending(1, [opening("t2")]));

    assert.equal(answer.accepted && answer.revision, 2);
    assert.equal(snapshots().length, 1);
    assert.equal(model.calls.includes("update workspaceSnapshots.workspaceSnapshots:1"), true);
  });

  it("merges a change set whose ground has not moved", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));
    await submitWorkspaceChanges(sending(1, [{ op: "zoom", tab: "t1", was: 100, now: 150 }]));

    const answer = await submitWorkspaceChanges(
      sending(1, [{ op: "activate", was: "t1", now: "t1" }])
    );

    assert.deepEqual(answer, { accepted: true, revision: 3, merged: true });
    assert.equal((snapshots()[0].views as Record<string, { zoom: number }>).t1.zoom, 150);
  });

  it("refuses a change set whose ground has moved", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));
    await submitWorkspaceChanges(sending(1, [{ op: "zoom", tab: "t1", was: 100, now: 150 }]));

    const answer = await submitWorkspaceChanges(
      sending(1, [{ op: "zoom", tab: "t1", was: 100, now: 75 }])
    );

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted === false && answer.reason, "conflict");
    assert.equal(answer.accepted === false && answer.revision, 2);
    assert.match(answer.accepted === false ? answer.detail : "", /tab:t1 moved/);
  });

  it("a refused change set writes nothing", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));
    await submitWorkspaceChanges(sending(1, [{ op: "zoom", tab: "t1", was: 100, now: 150 }]));
    const revisions = model.tables.workspaceRevisions.length;

    await submitWorkspaceChanges(sending(1, [{ op: "zoom", tab: "t1", was: 100, now: 75 }]));

    assert.equal(model.tables.workspaceRevisions.length, revisions);
    assert.equal(snapshots()[0].revision, 2);
  });

  it("refuses an op naming a tab the workspace does not hold", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));

    const answer = await submitWorkspaceChanges(
      sending(1, [{ op: "zoom", tab: "gone", was: 100, now: 150 }])
    );

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted === false && answer.reason, "unresolved");
    assert.match(answer.accepted === false ? answer.detail : "", /no tab gone/);
  });

  it("takes the revision from the row rather than from the sender", async () => {
    snapshots().push({
      _id: "workspaceSnapshots:1",
      projectId: "p",
      userId: "u",
      revision: 40,
      tabs: [{ id: "t1", category: "project-overview" }],
      activeId: "t1",
      views: { t1: view }
    });

    const answer = await submitWorkspaceChanges(sending(40, [{ op: "activate", was: "t1", now: "t1" }]));

    assert.equal(answer.accepted && answer.revision, 41);
  });
});
