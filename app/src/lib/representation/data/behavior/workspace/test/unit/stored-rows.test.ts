import { describe, expect, it } from "vitest";
import {
  isStoredWorkspaceRevision,
  isStoredWorkspaceSnapshot
} from "$representation/data/behavior/workspace/stored-rows";
import { startingWorkspace } from "$representation/data/behavior/workspace/starting";

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

describe("current workspace storage", () => {
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
