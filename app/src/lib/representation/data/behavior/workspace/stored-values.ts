import { isCategory, isContentView } from "$representation/data/behavior/workspace/categories";
import {
  defaultContext,
  offersContext
} from "$representation/data/behavior/workspace/opening";
import { isContextView, isInspectorView } from "$representation/data/behavior/workspace/views";
import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
import { normalizeExternalDirectoryPath } from "$representation/data/behavior/external/file";
import type { Category } from "$representation/data/types/workspace/categories";
import type {
  Frame,
  Landing,
  Selection,
  TabRecord,
  TabView,
  Target
} from "$representation/data/types/workspace/tab";

const resourceTable = (category: Category) => {
  if (category === "document-editor") return "documents";
  if (category === "presentation-editor") return "presentations";
  if (category === "spreadsheet-editor") return "spreadsheets";
  if (category === "research") return "researchThreads";
  return undefined;
};

const categoryValue = (value: unknown): value is Category =>
  typeof value === "string" && isCategory(value);

const resourceForCategory = (category: Category, value: unknown): boolean => {
  const table = resourceTable(category);
  if (table !== undefined) return isStoredRowId(value, table);
  if (category === "analysis") return value === undefined || isStoredIdentifier(value);
  return value === undefined;
};

const focusForCategory = (category: Category, value: unknown): boolean =>
  category === "external"
    ? isStoredRowId(value, "externalFiles")
    : isStoredIdentifier(value);

const inspectorForCategory = (
  category: Category,
  inspected: string
): boolean => {
  if (inspected.startsWith(`${category}.`) || inspected.startsWith("general.")) return true;
  if (inspected === "project-overview.activity") return true;
  // New Tab reuses the resource lens, its actor links, and the template lens.
  if (category === "new-tab") return [
    "project-overview.resource",
    "project-overview.file",
    "project-overview.connector",
    "agents.task",
    "templates.template"
  ].includes(inspected);
  return category === "project-overview" &&
    (inspected === "agents.task" || inspected === "agents.persona");
};

export const isStoredTarget = (value: unknown): value is Target => {
  const target = storedFields(value);
  if (
    target === undefined ||
    !hasExactFields(target, ["category"], ["content", "context", "resourceId", "focus"]) ||
    !categoryValue(target.category) ||
    !resourceForCategory(target.category, target.resourceId)
  ) return false;
  return (target.content === undefined || (
    typeof target.content === "string" &&
    isContentView(target.content) &&
    target.content.startsWith(`${target.category}.`)
  )) &&
    (target.context === undefined || (
      typeof target.context === "string" &&
      isContextView(target.context) &&
      offersContext(target.category, target.context)
    )) &&
    (target.focus === undefined || focusForCategory(target.category as Category, target.focus));
};

/** The smaller target persisted by open/close operations after routing is resolved. */
export const isStoredTabTarget = (value: unknown): boolean => {
  const target = storedFields(value);
  return target !== undefined &&
    hasExactFields(target, ["category"], ["resourceId"]) &&
    categoryValue(target.category) &&
    resourceForCategory(target.category, target.resourceId);
};

export const isStoredTabRecord = (value: unknown): value is TabRecord => {
  const tab = storedFields(value);
  return tab !== undefined &&
    hasExactFields(tab, ["id", "category"], ["resourceId"]) &&
    isStoredIdentifier(tab.id) &&
    categoryValue(tab.category) &&
    resourceForCategory(tab.category, tab.resourceId);
};

const selectionRange = (value: unknown): boolean => {
  const range = storedFields(value);
  return range !== undefined &&
    hasExactFields(range, ["id", "at"]) &&
    isStoredIdentifier(range.id) &&
    isStoredIdentifier(range.at);
};

const currentExternalDirectory = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    return normalizeExternalDirectoryPath(value) === value;
  } catch {
    return false;
  }
};

const isStoredExternalSelection = (
  value: unknown,
  inspected: "external.file" | "external.directory"
): value is Selection => {
  const selection = storedFields(value);
  if (selection === undefined || !hasExactFields(selection, ["kind", "id"])) return false;
  return inspected === "external.file"
    ? selection.kind === "external-file" && isStoredRowId(selection.id, "externalFiles")
    : selection.kind === "external-directory" && currentExternalDirectory(selection.id);
};

const isStoredExternalOwnedInspection = (
  inspected: unknown,
  selection: unknown
): boolean => {
  if (inspected === "empty") return selection === null;
  return (inspected === "external.file" || inspected === "external.directory") &&
    isStoredExternalSelection(selection, inspected);
};

/** External-specific lenses stay nominal; shared lenses use the ordinary selection contract. */
export const isStoredExternalInspection = (
  inspected: unknown,
  selection: unknown
): boolean => {
  if (inspected === "empty") return selection === null;
  if (typeof inspected !== "string" || !inspectorForCategory("external", inspected)) return false;
  if (inspected === "external.file" || inspected === "external.directory") {
    return isStoredExternalOwnedInspection(inspected, selection);
  }
  return selection === null || isStoredSelection(selection);
};

export const isStoredSelection = (value: unknown): value is Selection => {
  const selection = storedFields(value);
  if (selection?.kind === "external-file") {
    return isStoredExternalSelection(value, "external.file");
  }
  if (selection?.kind === "external-directory") {
    return isStoredExternalSelection(value, "external.directory");
  }
  return selection !== undefined &&
    hasExactFields(selection, ["kind", "id"], ["at", "ranges", "ids"]) &&
    isStoredIdentifier(selection.kind) &&
    isStoredIdentifier(selection.id) &&
    (selection.at === undefined || isStoredIdentifier(selection.at)) &&
    (selection.ranges === undefined || (
      Array.isArray(selection.ranges) &&
      selection.ranges.every(selectionRange) &&
      new Set((selection.ranges as Array<{ id: string }>).map((range) => range.id)).size === selection.ranges.length
    )) &&
    (selection.ids === undefined || (
      Array.isArray(selection.ids) &&
      selection.ids.every((id) => isStoredIdentifier(id)) &&
      new Set(selection.ids).size === selection.ids.length
    ));
};

export const isStoredFrame = (value: unknown): value is Frame => {
  const frame = storedFields(value);
  return frame !== undefined &&
    hasExactFields(
      frame,
      ["contextWidth", "contextCollapsed", "inspectorWidth", "inspectorCollapsed"]
    ) &&
    isStoredFinite(frame.contextWidth) && frame.contextWidth >= 0 &&
    typeof frame.contextCollapsed === "boolean" &&
    isStoredFinite(frame.inspectorWidth) && frame.inspectorWidth >= 0 &&
    typeof frame.inspectorCollapsed === "boolean";
};

const storedLanding = (
  value: unknown,
  category?: Category,
  tabView = false
): value is Landing => {
  const landing = storedFields(value);
  if (
    landing === undefined ||
    !hasExactFields(
      landing,
      ["content", "focus", "contextId", "inspected", "selection"],
      tabView ? ["frame", "zoom"] : []
    ) ||
    typeof landing.content !== "string" ||
    !isContentView(landing.content) ||
    (category !== undefined && !landing.content.startsWith(`${category}.`)) ||
    (landing.contextId !== null && (
      typeof landing.contextId !== "string" ||
      !isContextView(landing.contextId)
    )) ||
    (landing.inspected !== "empty" && (
      typeof landing.inspected !== "string" || !isInspectorView(landing.inspected)
    ))
  ) return false;
  const contentCategory = landing.content.slice(0, landing.content.indexOf("."));
  if (!isCategory(contentCategory)) return false;
  const owner = category ?? contentCategory;
  if (landing.focus !== null && !focusForCategory(owner, landing.focus)) return false;
  if (
    landing.contextId === null
      ? defaultContext(owner) !== null
      : !offersContext(owner, landing.contextId)
  ) return false;
  if (landing.inspected === "empty") return landing.selection === null;
  if (!inspectorForCategory(owner, landing.inspected)) return false;
  if (owner === "external") return isStoredExternalInspection(
    landing.inspected,
    landing.selection
  );
  return landing.selection === null || isStoredSelection(landing.selection);
};

export const isStoredLanding = (value: unknown): value is Landing => storedLanding(value);

export const isStoredTabViewFor = (value: unknown, category: Category): value is TabView => {
  const view = storedFields(value);
  return view !== undefined &&
    hasExactFields(
      view,
      ["content", "focus", "contextId", "inspected", "selection", "frame", "zoom"]
    ) &&
    storedLanding(value, category, true) &&
    isStoredFrame(view.frame) &&
    (view.zoom === null || (isStoredFinite(view.zoom) && view.zoom > 0));
};

export const isStoredZoom = (value: unknown): boolean =>
  value === null || (isStoredFinite(value) && value > 0);

export const isStoredPosition = isStoredNatural;
