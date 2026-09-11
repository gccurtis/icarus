import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { startingWorkspace } from "$representation/data/behavior/workspace/starting";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  failOn: undefined as string | undefined,
  tables: { workspaceSnapshots: [] as Row[], workspaceRevisions: [] as Row[] },
  store: {
    create: (table: "workspaceSnapshots" | "workspaceRevisions", fields: unknown) => {
      model.calls.push(`create ${table}`);
      if (model.failOn === `create ${table}`) throw new Error(`fault at create ${table}`);
      const held = model.tables[table];
      const id = `${table}:${held.length + 1}`;
      held.push({ ...(fields as Row), _id: id, _creationTime: 1 });
      return id;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      const table = path as "workspaceSnapshots" | "workspaceRevisions";
      return { table, kind: "table", rows: model.tables[table] ?? [] };
    },
    update: (path: string, value: unknown) => {
      model.calls.push(`update ${path}`);
      if (model.failOn === `update ${path}`) throw new Error(`fault at update ${path}`);
      const [table, id] = path.split(".") as ["workspaceSnapshots" | "workspaceRevisions", string];
      model.tables[table] = model.tables[table].map((row) =>
        row._id === id
          ? { ...(value as Row), _id: id, _creationTime: row._creationTime }
          : row
      );
    },
    remove: (path: string) => model.calls.push(`remove ${path}`),
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T => {
      model.calls.push("transaction");
      const before = structuredClone(model.tables);
      try {
        return work(model.store as unknown as StoreUnitOfWork);
      } catch (error) {
        model.tables = before;
        throw error;
      }
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({
    projectId: "projects:p",
    userId: "users:u",
    username: "You"
  })
}));

const { readWorkspaceState } = await import(
  "$capabilities/workspace/api/read-workspace-state/read-workspace-state"
);
const { submitWorkspaceChanges } = await import(
  "$capabilities/workspace/api/submit-workspace-changes/submit-workspace-changes"
);

const projectView = {
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

const opening = (tab: string, resourceId?: string) => resourceId === undefined
  ? ({
      op: "open",
      tab,
      at: 4,
      target: { category: "new-tab" },
      view: {
        ...projectView,
        content: "new-tab.launcher",
        contextId: "new-tab.templates"
      }
    })
  : ({
      op: "open",
      tab,
      at: 4,
      target: { category: "document-editor", resourceId },
      view: {
        ...projectView,
        content: "document-editor.document",
        contextId: "document-editor.layout"
      }
    });

const sending = (baseRevision: number, ops: unknown[]) => ({ changeSet: { baseRevision, ops } });

const snapshots = () => model.tables.workspaceSnapshots;
const snapshotAt = (
  id: string,
  projectId: string,
  userId: string,
  revision: number
): Row => {
  const initial = startingWorkspace();
  return {
    _id: `workspaceSnapshots:${id}`,
    _creationTime: 1,
    projectId,
    userId,
    revision,
    tabs: initial.tabs,
    activeId: initial.activeId,
    views: initial.views,
    at: 1
  };
};
const historyThrough = (revision: number): Row[] => Array.from(
  { length: revision },
  (_, index) => ({
    _id: `workspaceRevisions:${index + 1}`,
    _creationTime: 1,
    projectId: "projects:p",
    userId: "users:u",
    revision: index + 1,
    baseRevision: index,
    ops: [{ op: "activate", was: "project-overview", now: "project-overview" }],
    at: index + 1
  })
);

beforeEach(() => {
  model.calls.length = 0;
  model.failOn = undefined;
  model.tables.workspaceSnapshots.length = 0;
  model.tables.workspaceRevisions.length = 0;
});

describe("reading", () => {
  it("answers nothing on a first visit", async () => {
    assert.equal(await readWorkspaceState(), null);
  });

  it("answers this scope's row and no other", async () => {
    snapshots().push(
      snapshotAt("1", "projects:other", "users:u", 9),
      snapshotAt("2", "projects:p", "users:other", 8),
      snapshotAt("3", "projects:p", "users:u", 7)
    );

    const found = await readWorkspaceState();

    assert.equal(found?.revision, 7);
    assert.equal(found?.activeId, "project-overview");
  });

  it("hands back no key, because a caller could not have asked for another one", async () => {
    snapshots().push(snapshotAt("1", "projects:p", "users:u", 1));

    const found = await readWorkspaceState();

    assert.deepEqual(Object.keys(found ?? {}).sort(), ["activeId", "revision", "tabs", "views"]);
  });

  it("rejects duplicate leaders instead of selecting one by table order", async () => {
    snapshots().push(
      snapshotAt("1", "projects:p", "users:u", 1),
      snapshotAt("2", "projects:p", "users:u", 2)
    );

    await expect(readWorkspaceState()).rejects.toThrow(/more than one workspace leader/);
  });
});

describe("submitting", () => {
  it("refuses an envelope it cannot act on", async () => {
    await expect(submitWorkspaceChanges("nope")).rejects.toThrow(/exactly one changeSet/);
    await expect(submitWorkspaceChanges({})).rejects.toThrow(/exactly one changeSet/);
    await expect(submitWorkspaceChanges(sending(0, []))).rejects.toThrow(/at least one op/);
    await expect(submitWorkspaceChanges(sending(-1, [opening("t1")]))).rejects.toThrow(
      /revision number/
    );
    await expect(submitWorkspaceChanges(sending(0, [{ op: "teleport" }]))).rejects.toThrow(
      /exactly one current workspace operation/
    );
  });

  it("does not reach the store when it refuses", async () => {
    await expect(submitWorkspaceChanges({})).rejects.toThrow();
    assert.deepEqual(model.calls, []);
  });

  it("rejects unknown own fields at every command layer", async () => {
    await expect(submitWorkspaceChanges({
      changeSet: { baseRevision: 0, ops: [opening("t1")] },
      oldWorkspace: true
    })).rejects.toThrow(/exactly one changeSet/);
    await expect(submitWorkspaceChanges({
      changeSet: { baseRevision: 0, ops: [opening("t1")], oldRevision: 0 }
    })).rejects.toThrow(/exactly baseRevision and ops/);
    await expect(submitWorkspaceChanges(sending(0, [{
      ...opening("t1"),
      oldView: {}
    }]))).rejects.toThrow(/exactly one current workspace operation/);
    await expect(submitWorkspaceChanges(sending(0, [{
      ...opening("t1"),
      target: { category: "new-tab", content: "new-tab.launcher" }
    }]))).rejects.toThrow(/exactly one current workspace operation/);

    const hidden = sending(0, [opening("t1")]);
    Object.defineProperty(hidden, "oldWorkspace", { value: true, enumerable: false });
    const symbol = { ...sending(0, [opening("t1")]), [Symbol("oldWorkspace")]: true };
    await expect(submitWorkspaceChanges(hidden)).rejects.toThrow(/plain JSON data/);
    await expect(submitWorkspaceChanges(symbol)).rejects.toThrow(/plain JSON data/);
    await expect(submitWorkspaceChanges({
      changeSet: {
        baseRevision: 0,
        ops: [{ ...opening("t1"), target: { category: "new-tab", resourceId: undefined } }]
      }
    })).rejects.toThrow(/plain JSON data/);
    const accessor = sending(0, [opening("t1")]);
    Object.defineProperty(accessor.changeSet, "baseRevision", {
      enumerable: true,
      get: () => 0
    });
    await expect(submitWorkspaceChanges(accessor)).rejects.toThrow(/plain JSON data/);
    assert.deepEqual(model.calls, []);
  });

  it("an empty workspace starts on the singletons rather than on nothing", async () => {
    await submitWorkspaceChanges(sending(0, [{
      op: "activate",
      was: "project-overview",
      now: "agents"
    }]));

    assert.deepEqual(
      (snapshots()[0].tabs as Row[]).map((tab) => tab.id),
      ["project-overview", "agents", "templates", "external"]
    );
  });

  it("applies the ops itself rather than storing a snapshot the client sent", async () => {
    const answer = await submitWorkspaceChanges(sending(0, [opening("t1", "documents:k57")]));

    assert.deepEqual(answer, { accepted: true, revision: 1, merged: false });
    assert.deepEqual((snapshots()[0].tabs as Row[]).find((tab) => tab.id === "t1"), {
      id: "t1",
      category: "document-editor",
      resourceId: "documents:k57"
    });
  });

  it("a tab with no resource carries no key for one", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));

    const opened = (snapshots()[0].tabs as Row[]).find((tab) => tab.id === "t1");

    assert.deepEqual(opened, { id: "t1", category: "new-tab" });
    assert.equal("resourceId" in (opened ?? {}), false);
  });

  it.each([
    ["project-overview.resource", { kind: "document", id: "documents:k57" }],
    ["project-overview.file", { kind: "file", id: "externalFiles:one" }],
    ["project-overview.connector", { kind: "connector", id: "connectors:one" }],
    ["agents.task", { kind: "task", id: "agentTasks:one" }],
    ["templates.template", { kind: "template", id: "templates:one" }]
  ] as const)("saves, reloads, and consumes a New Tab inspecting %s", async (inspected, selection) => {
    const opened = await submitWorkspaceChanges(sending(0, [
      opening("launcher"),
      { op: "activate", was: "project-overview", now: "launcher" }
    ]));
    assert.deepEqual(opened, { accepted: true, revision: 1, merged: false });

    const selected = await submitWorkspaceChanges(sending(1, [{
      op: "inspect",
      tab: "launcher",
      was: "empty",
      now: inspected,
      wasSelection: null,
      selection
    }]));
    assert.deepEqual(selected, { accepted: true, revision: 2, merged: false });
    const reloaded = await readWorkspaceState();
    assert.ok(reloaded);
    assert.equal(reloaded.activeId, "launcher");
    assert.equal(reloaded.views.launcher.inspected, inspected);
    assert.deepEqual(reloaded.views.launcher.selection, selection);
    assert.equal(reloaded.views.launcher.contextId, "new-tab.templates");

    const consumed = await submitWorkspaceChanges(sending(2, [
      { ...opening("document", "documents:k57"), at: reloaded.tabs.length },
      { op: "activate", was: "launcher", now: "document" },
      {
        op: "close",
        tab: "launcher",
        at: reloaded.tabs.findIndex((tab) => tab.id === "launcher"),
        target: { category: "new-tab" },
        view: reloaded.views.launcher
      }
    ]));
    assert.deepEqual(consumed, { accepted: true, revision: 3, merged: false });
    const afterClose = await readWorkspaceState();
    assert.ok(afterClose);
    assert.equal(afterClose.revision, 3);
    assert.equal(afterClose.activeId, "document");
    assert.equal(afterClose.tabs.some((tab) => tab.id === "launcher"), false);
    assert.equal("launcher" in afterClose.views, false);
    assert.deepEqual(afterClose.tabs.find((tab) => tab.id === "document"), {
      id: "document", category: "document-editor", resourceId: "documents:k57"
    });
    assert.equal(model.tables.workspaceRevisions.length, 3);
  });

  it.each(["templates.template-variable", "document-editor.text-block"])(
    "refuses unrelated %s inspection on New Tab without publishing another revision",
    async (inspected) => {
      await submitWorkspaceChanges(sending(0, [opening("launcher")]));
      const answer = await submitWorkspaceChanges(sending(1, [{
        op: "inspect",
        tab: "launcher",
        was: "empty",
        now: inspected,
        wasSelection: null,
        selection: { kind: "resource", id: "documents:k57" }
      }]));
      assert.equal(answer.accepted, false);
      assert.match(answer.accepted ? "" : answer.detail, /cannot hold that view/);
      assert.equal(snapshots()[0].revision, 1);
      assert.equal(model.tables.workspaceRevisions.length, 1);
      const reloaded = await readWorkspaceState();
      assert.equal(reloaded?.views.launcher.inspected, "empty");
    }
  );

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
      sending(1, [{ op: "activate", was: "project-overview", now: "t1" }])
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

  it("refuses a future base and rejects a missing or divergent revision chain", async () => {
    const future = await submitWorkspaceChanges(sending(2, [opening("t1")]));
    assert.equal(future.accepted, false);
    assert.equal(future.accepted ? "" : future.reason, "unresolved");
    assert.match(future.accepted ? "" : future.detail, /ahead of current revision/);

    const initial = startingWorkspace();
    snapshots().push({
      _id: "workspaceSnapshots:1",
      _creationTime: 1,
      projectId: "projects:p",
      userId: "users:u",
      revision: 2,
      tabs: initial.tabs,
      activeId: initial.activeId,
      views: initial.views,
      at: 1
    });
    model.tables.workspaceRevisions.push(historyThrough(2)[1]!);

    await expect(submitWorkspaceChanges(sending(2, [{
      op: "activate",
      was: "project-overview",
      now: "agents"
    }]))).rejects.toThrow(/not contiguous/);
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

  it("refuses forged previous values and a view from another tab category", async () => {
    await submitWorkspaceChanges(sending(0, [opening("t1")]));
    const revisionCount = model.tables.workspaceRevisions.length;

    const forged = await submitWorkspaceChanges(sending(1, [{
      op: "zoom",
      tab: "t1",
      was: 75,
      now: 125
    }]));
    assert.equal(forged.accepted, false);
    assert.match(forged.accepted ? "" : forged.detail, /no longer matches/);

    const crossed = await submitWorkspaceChanges(sending(1, [{
      op: "land",
      tab: "t1",
      was: {
        content: "new-tab.launcher",
        focus: null,
        contextId: "new-tab.templates",
        inspected: "empty",
        selection: null
      },
      now: {
        content: "document-editor.document",
        focus: null,
        contextId: "document-editor.layout",
        inspected: "empty",
        selection: null
      }
    }]));
    assert.equal(crossed.accepted, false);
    assert.match(crossed.accepted ? "" : crossed.detail, /cannot hold that view/);
    assert.equal(model.tables.workspaceRevisions.length, revisionCount);
  });

  it("rolls back the revision when snapshot publication fails", async () => {
    model.failOn = "create workspaceSnapshots";

    await expect(submitWorkspaceChanges(sending(0, [opening("t1")]))).rejects.toThrow(
      /fault at create workspaceSnapshots/
    );
    assert.deepEqual(model.tables.workspaceRevisions, []);
    assert.deepEqual(model.tables.workspaceSnapshots, []);
  });

  it("takes the revision from the row rather than from the sender", async () => {
    const initial = startingWorkspace();
    snapshots().push({
      _id: "workspaceSnapshots:1",
      _creationTime: 1,
      projectId: "projects:p",
      userId: "users:u",
      revision: 40,
      tabs: initial.tabs,
      activeId: initial.activeId,
      views: initial.views,
      at: 1
    });
    model.tables.workspaceRevisions.push(...historyThrough(40));

    const answer = await submitWorkspaceChanges(sending(40, [{
      op: "activate",
      was: "project-overview",
      now: "project-overview"
    }]));

    assert.equal(answer.accepted && answer.revision, 41);
  });
});
