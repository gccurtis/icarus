import { describe, expect, it } from "vitest";

import { openingView } from "$representation/data/behavior/workspace/opening";
import { isStoredWorkspaceOp } from "$representation/data/behavior/workspace/stored-rows";
import {
  isStoredTabViewFor,
  isStoredTarget
} from "$representation/data/behavior/workspace/stored-values";

describe("External workspace identity", () => {
  it("admits only a nominal external-file focus", () => {
    expect(isStoredTarget({ category: "external", focus: "externalFiles:one" })).toBe(true);
    expect(isStoredTarget({ category: "external", focus: "one" })).toBe(false);
    expect(isStoredTarget({ category: "external", focus: "documents:one" })).toBe(false);
  });

  it("ties External inspectors to their exact current selection shape", () => {
    const view = openingView("external", { focus: "externalFiles:one" });
    expect(isStoredTabViewFor({
      ...view,
      inspected: "external.file",
      selection: { kind: "external-file", id: "externalFiles:one" }
    }, "external")).toBe(true);
    expect(isStoredTabViewFor({
      ...view,
      inspected: "external.directory",
      selection: { kind: "external-directory", id: "Client Files/2026" }
    }, "external")).toBe(true);
    expect(isStoredTabViewFor({
      ...view,
      inspected: "external.file",
      selection: { kind: "external-file", id: "one" }
    }, "external")).toBe(false);
    expect(isStoredTabViewFor({
      ...view,
      inspected: "external.file",
      selection: { kind: "external-file", id: "externalFiles:one", at: "old-shape" }
    }, "external")).toBe(false);
    expect(isStoredTabViewFor({
      ...view,
      inspected: "document-editor.image",
      selection: { kind: "external-file", id: "externalFiles:one" }
    }, "external")).toBe(false);
    expect(isStoredTabViewFor({
      ...view,
      inspected: "general.person",
      selection: { kind: "person", id: "users:author" }
    }, "external")).toBe(true);
  });

  it("rejects a bare file id in an External inspect operation", () => {
    const base = {
      op: "inspect",
      tab: "external",
      was: "empty",
      now: "external.file",
      wasSelection: null,
      selection: { kind: "external-file", id: "externalFiles:one" }
    } as const;
    expect(isStoredWorkspaceOp(base)).toBe(true);
    expect(isStoredWorkspaceOp({
      ...base,
      selection: { kind: "external-file", id: "one" }
    })).toBe(false);
  });

  it("pairs each External inspector with its exact selection at op admission", () => {
    const file = { kind: "external-file", id: "externalFiles:one" } as const;
    const directory = { kind: "external-directory", id: "Client Files" } as const;
    const base = {
      op: "inspect",
      tab: "external",
      was: "empty",
      now: "external.file",
      wasSelection: null,
      selection: file
    } as const;

    expect(isStoredWorkspaceOp(base)).toBe(true);
    expect(isStoredWorkspaceOp({ ...base, selection: directory })).toBe(false);
    expect(isStoredWorkspaceOp({
      ...base,
      now: "external.directory",
      selection: file
    })).toBe(false);
    expect(isStoredWorkspaceOp({
      ...base,
      selection: { kind: "resource", id: "externalFiles:one" }
    })).toBe(false);
    expect(isStoredWorkspaceOp({
      ...base,
      was: "external.file",
      wasSelection: directory
    })).toBe(false);
    expect(isStoredWorkspaceOp({
      ...base,
      now: "empty",
      selection: file
    })).toBe(false);
    expect(isStoredWorkspaceOp({
      ...base,
      was: "external.file",
      wasSelection: file,
      now: "general.person",
      selection: { kind: "person", id: "users:author" }
    })).toBe(true);

    expect(isStoredWorkspaceOp({
      ...base,
      tab: "another-tab",
      selection: { kind: "resource", id: "externalFiles:one" }
    })).toBe(true);
  });
});
