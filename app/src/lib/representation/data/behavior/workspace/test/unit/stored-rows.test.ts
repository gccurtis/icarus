import { describe, expect, it } from "vitest";
import {
  isStoredWorkspaceOp,
  isStoredWorkspaceRevision,
  isStoredWorkspaceSnapshot
} from "$representation/data/behavior/workspace/stored-rows";
import { startingWorkspace } from "$representation/data/behavior/workspace/starting";
import { openingView } from "$representation/data/behavior/workspace/opening";

const frame = {
  contextWidth: 180,
  contextCollapsed: false,
  inspectorWidth: 224,
  inspectorCollapsed: false
};

const view = () => ({
  content: "document-editor.document",
  focus: null,
  contextId: "document-editor.layout",
  inspected: "empty",
  selection: null,
  frame,
  zoom: null
});

const snapshot = () => {
  const starting = startingWorkspace();
  return {
    _id: "workspaceSnapshots:1",
    _creationTime: 1,
    projectId: "default",
    userId: "default-user",
    revision: 1,
    tabs: [
      ...starting.tabs,
      { id: "tab-1", category: "document-editor", resourceId: "documents:1" }
    ],
    activeId: "tab-1",
    views: { ...starting.views, "tab-1": view() },
    at: 2
  };
};

const revision = () => ({
  _id: "workspaceRevisions:1",
  _creationTime: 1,
  projectId: "default",
  userId: "default-user",
  revision: 1,
  baseRevision: 0,
  ops: [{
    op: "open",
    tab: "tab-1",
    at: 0,
    target: { category: "document-editor", resourceId: "documents:1" },
    view: view()
  }],
  at: 2
});

const selectedLauncher = (inspected: string, selection: { kind: string; id: string }) => {
  const initial = startingWorkspace();
  return {
    ...snapshot(),
    tabs: [...initial.tabs, { id: "launcher", category: "new-tab" }],
    activeId: "launcher",
    views: {
      ...initial.views,
      launcher: { ...openingView("new-tab"), inspected, selection }
    }
  };
};

describe("current workspace storage", () => {
  it.each([
    ["project-overview.resource", { kind: "document", id: "documents:one" }],
    ["project-overview.file", { kind: "file", id: "externalFiles:one" }],
    ["project-overview.connector", { kind: "connector", id: "connectors:one" }],
    ["agents.task", { kind: "task", id: "agentTasks:one" }]
  ] as const)("admits New Tab's %s inspection in snapshots and open/close logs", (inspected, selection) => {
    const selected = selectedLauncher(inspected, selection);
    expect(isStoredWorkspaceSnapshot(selected)).toBe(true);
    const ops = ["open", "close"].map((op) => ({
      op,
      tab: "launcher",
      at: startingWorkspace().tabs.length,
      target: { category: "new-tab" },
      view: selected.views.launcher
    }));
    for (const op of ops) expect(isStoredWorkspaceOp(op)).toBe(true);
    expect(isStoredWorkspaceRevision({ ...revision(), ops })).toBe(true);

    // The same resource-table lens is not newly admitted on unrelated categories.
    expect(isStoredWorkspaceOp({
      ...ops[0],
      target: { category: "document-editor", resourceId: "documents:one" },
      view: { ...openingView("document-editor"), inspected, selection }
    })).toBe(false);
  });

  it.each([
    "templates.template",
    "document-editor.text-block",
    "project-overview.comment",
    "agents.persona"
  ])("still rejects unrelated %s inspection on New Tab", (inspected) => {
    const selected = selectedLauncher(inspected, { kind: "resource", id: "documents:one" });
    expect(isStoredWorkspaceSnapshot(selected)).toBe(false);
    for (const op of ["open", "close"]) {
      expect(isStoredWorkspaceOp({
        op,
        tab: "launcher",
        at: startingWorkspace().tabs.length,
        target: { category: "new-tab" },
        view: selected.views.launcher
      })).toBe(false);
    }
  });

  it("admits exact snapshots and operation logs", () => {
    expect(isStoredWorkspaceSnapshot(snapshot())).toBe(true);
    expect(isStoredWorkspaceRevision(revision())).toBe(true);
    expect(isStoredWorkspaceRevision({
      ...revision(),
      ops: [{
        op: "inspect",
        tab: "tab-1",
        was: "empty",
        now: "document-editor.text-block",
        wasSelection: null,
        selection: { kind: "text-block", id: "block-1" }
      }]
    })).toBe(true);
  });

  it("rejects missing or extra views and mismatched resource namespaces", () => {
    expect(isStoredWorkspaceSnapshot({ ...snapshot(), views: {} })).toBe(false);
    expect(isStoredWorkspaceSnapshot({
      ...snapshot(),
      views: { ...snapshot().views, retired: view() }
    })).toBe(false);
    expect(isStoredWorkspaceSnapshot({
      ...snapshot(),
      tabs: snapshot().tabs.map((tab) => tab.id === "tab-1"
        ? { ...tab, resourceId: "presentations:1" }
        : tab)
    })).toBe(false);
    expect(isStoredWorkspaceSnapshot({
      ...snapshot(),
      views: {
        ...snapshot().views,
        "tab-1": { ...view(), contextId: "document-editor.context" }
      }
    })).toBe(false);
    expect(isStoredWorkspaceSnapshot({
      ...snapshot(),
      views: { ...snapshot().views, "tab-1": { ...view(), contextId: null } }
    })).toBe(false);
  });

  it("rejects a workspace that omits any current singleton instead of adopting it", () => {
    const current = snapshot();
    const withoutExternalView = Object.fromEntries(
      Object.entries(current.views).filter(([id]) => id !== "external")
    );
    expect(isStoredWorkspaceSnapshot({
      ...current,
      tabs: current.tabs.filter((tab) => tab.category !== "external"),
      views: withoutExternalView
    })).toBe(false);
  });

  it("rejects unknown op fields and discriminator coercion", () => {
    expect(isStoredWorkspaceRevision({
      ...revision(),
      ops: [{ ...revision().ops[0], oldTarget: {} }]
    })).toBe(false);
    expect(isStoredWorkspaceRevision({
      ...revision(),
      ops: [{ ...revision().ops[0], op: { toString: () => "open" } }]
    })).toBe(false);
    const hidden = revision();
    Object.defineProperty(hidden.ops[0], "oldView", { value: true, enumerable: false });
    expect(isStoredWorkspaceRevision(hidden)).toBe(false);
    expect(isStoredWorkspaceRevision({
      ...revision(),
      [Symbol("oldRevision")]: true
    })).toBe(false);

    const decorated = snapshot();
    Object.defineProperty(decorated.tabs, "oldTabs", { value: [], enumerable: false });
    expect(isStoredWorkspaceSnapshot(decorated)).toBe(false);
  });
});
