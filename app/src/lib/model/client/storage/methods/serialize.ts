import type {
  PersistedClient,
  PersistedPanels,
  PersistedTab,
  PersistedTabIdentity,
  PersistedTabOptions,
  PersistedWorkbench
} from "$model/client/storage/types";
import { EMPTY, STORAGE_VERSION } from "$model/client/storage/types";
import { isStoredIdentifier, isStoredRowId } from "$representation/data/behavior/core/stored";
import { isCategory } from "$representation/data/behavior/workspace/categories";
import { offersContext } from "$representation/data/behavior/workspace/opening";
import { isContextView } from "$representation/data/behavior/workspace/views";
import type { Category } from "$representation/data/types/workspace/categories";

/**
 * Turning stored text into a document, and back.
 *
 * Pure: no DOM, no `$app/*`, no runes. That is what lets it be tested directly
 * under the node environment, and it is the half of storage where every decision
 * actually lives — the browser half is two lines around `localStorage`.
 *
 * **Nothing here throws.** Stored text may be absent, malformed, or outside the
 * one current version. Those cases all mean "start from defaults"; a later save
 * writes a fresh complete current document.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnly = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).every((field) => fields.includes(field));

/**
 * A pixel width that is worth believing.
 *
 * Sanity only, not policy — the panel's minimum and maximum belong to the
 * component that enforces the drag, and clamping to them here would put the same
 * number in two places. This rejects what cannot be a width at all: `NaN`,
 * `Infinity`, negatives, fractions, and values no display could justify.
 */
const width = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000
    ? value
    : undefined;

const flag = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

/**
 * Panel geometry, or nothing.
 *
 * A present panel object is one complete current-schema value. Missing or
 * malformed fields invalidate the stored document; they are never repaired
 * into a shape that no current writer emitted.
 */
const panels = (value: unknown): PersistedPanels | undefined => {
  if (
    !isObject(value) ||
    !hasOnly(value, [
      "contextWidth",
      "contextCollapsed",
      "inspectorWidth",
      "inspectorCollapsed"
    ])
  ) {
    return undefined;
  }
  const contextWidth = width(value.contextWidth);
  const contextCollapsed = flag(value.contextCollapsed);
  const inspectorWidth = width(value.inspectorWidth);
  const inspectorCollapsed = flag(value.inspectorCollapsed);
  if (
    contextWidth === undefined ||
    contextCollapsed === undefined ||
    inspectorWidth === undefined ||
    inspectorCollapsed === undefined
  ) {
    return undefined;
  }
  return {
    contextWidth,
    contextCollapsed,
    inspectorWidth,
    inspectorCollapsed
  };
};

/**
 * A tab's remembered options, or nothing when it remembers none.
 *
 * A current writer omits the third tuple member when there are no options, so a
 * present member must be a complete current options object.
 */
const options = (value: unknown, category: Category): PersistedTabOptions | undefined => {
  if (!isObject(value) || !hasOnly(value, ["contextId", "panels"])) return undefined;

  const contextId =
    typeof value.contextId === "string" &&
      isContextView(value.contextId) &&
      offersContext(category, value.contextId)
      ? value.contextId
      : undefined;
  const geometry = value.panels === undefined ? undefined : panels(value.panels);

  if (
    (value.contextId !== undefined && contextId === undefined) ||
    (value.panels !== undefined && geometry === undefined) ||
    (contextId === undefined && geometry === undefined)
  ) {
    return undefined;
  }
  return {
    ...(contextId === undefined ? {} : { contextId }),
    ...(geometry === undefined ? {} : { panels: geometry })
  };
};

type IdentityPredicate = (id: unknown) => boolean;

/** A new Category cannot compile until its one persisted identity rule is named here. */
const IDENTITY = {
  agents: (id) => id === "agents",
  analysis: isStoredIdentifier,
  "context-editor": (id) => id === "context-editor",
  "document-editor": (id) => isStoredRowId(id, "documents"),
  "new-tab": (id) => id === "new-tab",
  "project-overview": (id) => id === "project-overview",
  research: (id) => isStoredRowId(id, "researchThreads"),
  "slide-deck-editor": (id) => isStoredRowId(id, "slideDecks"),
  "spreadsheet-editor": (id) => isStoredRowId(id, "spreadsheets"),
  templates: (id) => id === "templates"
} satisfies Record<Category, IdentityPredicate>;

const identity = (category: Category, id: unknown): id is string =>
  IDENTITY[category](id);

/**
 * A tab is two strings and, when it remembers anything, an options object.
 * Anything else is dropped rather than repaired: a half-understood tab would
 * open the wrong resource, which is worse than opening none.
 */
const tab = (value: unknown): PersistedTab | undefined => {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3)) return undefined;
  const [category, id, stored] = value as unknown[];
  if (typeof category !== "string" || !isCategory(category) || !identity(category, id)) {
    return undefined;
  }

  if (value.length === 2) return [category, id] as PersistedTabIdentity;
  const remembered = options(stored, category);
  return remembered === undefined
    ? undefined
    : [category, id, remembered] as PersistedTab;
};

const activeRef = (value: unknown): PersistedTabIdentity | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [category, id] = value;
  return typeof category === "string" && isCategory(category) && identity(category, id)
    ? [category, id] as PersistedTabIdentity
    : undefined;
};

const workbench = (value: unknown): PersistedWorkbench | undefined => {
  if (!isObject(value) || !hasOnly(value, ["tabs", "active"]) || !Array.isArray(value.tabs)) {
    return undefined;
  }
  const admitted = value.tabs.map(tab);
  if (admitted.some((candidate) => candidate === undefined)) return undefined;
  const tabs = admitted as PersistedTab[];
  const active = value.active === undefined ? undefined : activeRef(value.active);
  if (value.active !== undefined && active === undefined) return undefined;
  const keys = tabs.map(([category, id]) => `${category}\u0000${id}`);
  if (new Set(keys).size !== keys.length) return undefined;
  if (
    active !== undefined &&
    !keys.includes(`${active[0]}\u0000${active[1]}`)
  ) return undefined;

  return { tabs, ...(active === undefined ? {} : { active }) };
};

/**
 * Reads a stored document.
 *
 * A version mismatch discards everything. Partially interpreting a different
 * contract is harder to reason about than none, and the cost of discarding is
 * that a user re-drags a panel once.
 */
export const decode = (stored: string | null | undefined): PersistedClient => {
  if (typeof stored !== "string" || stored === "") return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return EMPTY;
  }

  if (
    !isObject(parsed) ||
    !hasOnly(parsed, ["v", "workbench"]) ||
    parsed.v !== STORAGE_VERSION
  ) {
    return EMPTY;
  }

  if (parsed.workbench === undefined) return EMPTY;
  const admitted = workbench(parsed.workbench);
  return admitted === undefined ? EMPTY : { v: STORAGE_VERSION, workbench: admitted };
};

/** Writes a document. Absent sections are omitted rather than stored as null. */
export const encode = (document: PersistedClient): string =>
  JSON.stringify({
    v: STORAGE_VERSION,
    ...(document.workbench ? { workbench: document.workbench } : {})
  });
