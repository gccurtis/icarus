import {
  hasExactFields,
  isStoredIdentifier,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import {
  isStoredFrame,
  isStoredExternalInspection,
  isStoredLanding,
  isStoredPosition,
  isStoredSelection,
  isStoredTabRecord,
  isStoredTabTarget,
  isStoredTabViewFor,
  isStoredZoom
} from "$representation/data/behavior/workspace/stored-values";
import {
  isContextView,
  isInspectorView
} from "$representation/data/behavior/workspace/views";
import { SINGLETONS } from "$representation/data/behavior/workspace/starting";
import type { Category } from "$representation/data/types/workspace/categories";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TableRow } from "$representation/store/tables";

const tabId = isStoredIdentifier;

const nullableContext = (value: unknown): boolean =>
  value === null || (typeof value === "string" && isContextView(value));

/** One exact current workspace operation, including every closed variant payload. */
export const isStoredWorkspaceOp = (value: unknown): value is WorkspaceOp => {
  if (!isStoredJson(value)) return false;
  const op = storedFields(value);
  if (op === undefined) return false;
  if (op.op === "open" || op.op === "close") {
    return hasExactFields(op, ["op", "tab", "at", "target", "view"]) &&
      tabId(op.tab) && isStoredPosition(op.at) && isStoredTabTarget(op.target) &&
      isStoredTabViewFor(op.view, (op.target as { category: Category }).category);
  }
  if (op.op === "activate") {
    return hasExactFields(op, ["op", "was", "now"]) && tabId(op.was) && tabId(op.now);
  }
  if (op.op === "land") {
    return hasExactFields(op, ["op", "tab", "was", "now"]) &&
      tabId(op.tab) && isStoredLanding(op.was) && isStoredLanding(op.now);
  }
  if (op.op === "context") {
    return hasExactFields(op, ["op", "tab", "was", "now"]) &&
      tabId(op.tab) && nullableContext(op.was) && nullableContext(op.now);
  }
  if (op.op === "inspect") {
    const current = hasExactFields(
      op,
      ["op", "tab", "was", "now", "wasSelection", "selection"]
    ) &&
      tabId(op.tab) &&
      (op.was === "empty" || (typeof op.was === "string" && isInspectorView(op.was))) &&
      (op.now === "empty" || (typeof op.now === "string" && isInspectorView(op.now))) &&
      (op.wasSelection === null || isStoredSelection(op.wasSelection)) &&
      (op.selection === null || isStoredSelection(op.selection));
    if (!current) return false;
    return op.tab !== "external" || (
      isStoredExternalInspection(op.was, op.wasSelection) &&
      isStoredExternalInspection(op.now, op.selection)
    );
  }
  if (op.op === "resize") {
    return hasExactFields(op, ["op", "tab", "was", "now"]) &&
      tabId(op.tab) && isStoredFrame(op.was) && isStoredFrame(op.now);
  }
  return op.op === "zoom" &&
    hasExactFields(op, ["op", "tab", "was", "now"]) &&
    tabId(op.tab) && isStoredZoom(op.was) && isStoredZoom(op.now);
};

const snapshotBody = (row: Record<string, unknown>): boolean => {
  if (
    !Array.isArray(row.tabs) ||
    !row.tabs.every(isStoredTabRecord) ||
    new Set((row.tabs as Array<{ id: string }>).map((tab) => tab.id)).size !== row.tabs.length ||
    !tabId(row.activeId)
  ) return false;
  const tabs = row.tabs as Array<{ id: string; category: Category }>;
  const views = storedFields(row.views);
  if (views === undefined || !tabs.some((tab) => tab.id === row.activeId)) return false;
  if (!SINGLETONS.every((category) => {
    const matches = tabs.filter((tab) => tab.category === category);
    return matches.length === 1 && matches[0].id === category;
  })) return false;
  const ids = new Set(tabs.map((tab) => tab.id));
  return Object.keys(views).length === ids.size &&
    Object.keys(views).every((id) => ids.has(id)) &&
    tabs.every((tab) => isStoredTabViewFor(views[tab.id], tab.category));
};

/** One exact current workspace body, without persistence metadata. */
export const isStoredWorkspaceBody = (value: unknown): boolean => {
  if (!isStoredJson(value)) return false;
  const body = storedFields(value);
  return body !== undefined &&
    hasExactFields(body, ["tabs", "activeId", "views"]) &&
    snapshotBody(body);
};

/** One complete current workspace snapshot with an exact tab/view bijection. */
export const isStoredWorkspaceSnapshot = (
  value: unknown
): value is TableRow<"workspaceSnapshots"> => {
  if (!isStoredJson(value)) return false;
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "userId", "revision", "tabs", "activeId", "views", "at"]
    ) &&
    isStoredRowId(row._id, "workspaceSnapshots") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.userId, "users") &&
    isStoredNatural(row.revision) &&
    isStoredTime(row.at) &&
    snapshotBody(row);
};

/** One complete current workspace revision; malformed ops invalidate it whole. */
export const isStoredWorkspaceRevision = (
  value: unknown
): value is TableRow<"workspaceRevisions"> => {
  if (!isStoredJson(value)) return false;
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "userId", "revision", "baseRevision", "ops", "at"]
    ) &&
    isStoredRowId(row._id, "workspaceRevisions") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.userId, "users") &&
    isStoredNatural(row.revision) && row.revision >= 1 &&
    isStoredNatural(row.baseRevision) && row.baseRevision < row.revision &&
    Array.isArray(row.ops) && row.ops.length > 0 && row.ops.every(isStoredWorkspaceOp) &&
    isStoredTime(row.at);
};
