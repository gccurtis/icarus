import { isCategory, isContentView } from "$representation/data/behavior/workspace/categories";
import { offersContext } from "$representation/data/behavior/workspace/opening";
import { isContextView, isInspectorView } from "$representation/data/behavior/workspace/views";
import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
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
  if (category === "slide-deck-editor") return "slideDecks";
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
    (target.focus === undefined || isStoredIdentifier(target.focus));
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

export const isStoredSelection = (value: unknown): value is Selection => {
  const selection = storedFields(value);
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
    (landing.focus !== null && !isStoredIdentifier(landing.focus)) ||
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
  return (landing.contextId === null || offersContext(owner, landing.contextId)) &&
    (landing.selection === null || isStoredSelection(landing.selection));
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
