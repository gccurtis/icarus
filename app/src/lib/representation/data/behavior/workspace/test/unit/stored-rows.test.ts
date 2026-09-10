import { describe, expect, it } from "vitest";
import {
  isStoredWorkspaceRevision,
  isStoredWorkspaceSnapshot
} from "$representation/data/behavior/workspace/stored-rows";

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

const snapshot = () => ({
  _id: "workspaceSnapshots:1",
  _creationTime: 1,
  projectId: "default",
  userId: "default-user",
  revision: 1,
  tabs: [{ id: "tab-1", category: "document-editor", resourceId: "documents:1" }],
  activeId: "tab-1",
  views: { "tab-1": view() },
  at: 2
});

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
        now: "slide-deck-editor.text-box",
        wasSelection: null,
        selection: { kind: "elements", id: "element-1", ids: ["element-1"] }
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
      tabs: [{ id: "tab-1", category: "document-editor", resourceId: "slideDecks:1" }]
    })).toBe(false);
    expect(isStoredWorkspaceSnapshot({
      ...snapshot(),
      views: { "tab-1": { ...view(), contextId: "document-editor.context" } }
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
  });
});
