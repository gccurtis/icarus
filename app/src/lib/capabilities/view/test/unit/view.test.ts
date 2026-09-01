import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  rows: [] as Row[],
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table}`);
      const id = `${table}:${model.rows.length + 1}`;
      if (table === "viewSnapshots") model.rows.push({ ...(fields as Row), _id: id });
      return id;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      return { table: "viewSnapshots", kind: "table", rows: model.rows };
    },
    update: (path: string, value: unknown) => {
      model.calls.push(`update ${path}`);
      const id = path.split(".")[1];
      model.rows = model.rows.map((row) => (row._id === id ? { ...(value as Row), _id: id } : row));
    },
    remove: (path: string) => model.calls.push(`remove ${path}`)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "u", username: "You" })
}));

const { readViewState } = await import("$capabilities/view/api/read-view-state/read-view-state");
const { submitViewChanges } = await import(
  "$capabilities/view/api/submit-view-changes/submit-view-changes"
);

const view = {
  subscreen: "workspace",
  focus: null,
  contextId: null,
  inspected: "empty",
  selection: null,
  frame: { contextWidth: 276, contextCollapsed: false, inspectorWidth: 320, inspectorCollapsed: false }
};

const change = (baseRevision: number) => ({
  baseRevision,
  ops: [{ op: "activate", was: "t1", now: "t2" }],
  tabs: [{ id: "t1", screen: "project-overview" }],
  activeId: "t1",
  views: { t1: view }
});

beforeEach(() => {
  model.calls.length = 0;
  model.rows.length = 0;
});

describe("reading", () => {
  it("answers nothing on a first visit", async () => {
    assert.equal(await readViewState(), null);
  });

  it("answers this scope's row and no other", async () => {
    model.rows.push(
      { _id: "viewSnapshots:1", projectId: "other", userId: "u", revision: 9, tabs: [], activeId: "t9", views: {} },
      { _id: "viewSnapshots:2", projectId: "p", userId: "other", revision: 8, tabs: [], activeId: "t8", views: {} },
      { _id: "viewSnapshots:3", projectId: "p", userId: "u", revision: 7, tabs: [], activeId: "t7", views: {} }
    );

    const found = await readViewState();

    assert.equal(found?.revision, 7);
    assert.equal(found?.activeId, "t7");
  });

  it("hands back no key, because a caller could not have asked for another one", async () => {
    model.rows.push({
      _id: "viewSnapshots:1",
      projectId: "p",
      userId: "u",
      revision: 1,
      tabs: [],
      activeId: "t1",
      views: {}
    });

    const found = await readViewState();

    assert.deepEqual(Object.keys(found ?? {}).sort(), ["activeId", "revision", "tabs", "views"]);
  });
});

describe("submitting", () => {
  it("refuses an envelope it cannot act on", async () => {
    await expect(submitViewChanges("nope")).rejects.toThrow(/an input is an object/);
    await expect(submitViewChanges({ ...change(0), ops: [] })).rejects.toThrow(/non-empty array/);
    await expect(submitViewChanges({ ...change(0), tabs: [] })).rejects.toThrow(/non-empty array/);
    await expect(submitViewChanges({ ...change(0), activeId: "" })).rejects.toThrow(/names a tab/);
    await expect(submitViewChanges({ ...change(0), views: [] })).rejects.toThrow(/mapping/);
    await expect(submitViewChanges({ ...change(0), baseRevision: -1 })).rejects.toThrow(/revision number/);
  });

  it("does not reach the store when it refuses", async () => {
    await expect(submitViewChanges({})).rejects.toThrow();
    assert.deepEqual(model.calls, []);
  });

  it("appends a revision and creates the snapshot on a first visit", async () => {
    const { revision } = await submitViewChanges(change(0));

    assert.equal(revision, 1);
    assert.deepEqual(model.calls, ["read viewSnapshots", "create viewRevisions", "create viewSnapshots"]);
  });

  it("replaces the one row rather than adding a second", async () => {
    await submitViewChanges(change(0));
    model.calls.length = 0;

    const { revision } = await submitViewChanges(change(1));

    assert.equal(revision, 2);
    assert.equal(model.rows.length, 1);
    assert.deepEqual(model.calls, [
      "read viewSnapshots",
      "create viewRevisions",
      "update viewSnapshots.viewSnapshots:1"
    ]);
  });

  it("takes the revision from the row rather than from the sender", async () => {
    model.rows.push({
      _id: "viewSnapshots:1",
      projectId: "p",
      userId: "u",
      revision: 40,
      tabs: [],
      activeId: "t1",
      views: {}
    });

    assert.equal((await submitViewChanges(change(3))).revision, 41);
  });
});
