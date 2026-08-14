import type {
  PersistedClient,
  PersistedPreferences,
  PersistedTab,
  PersistedWorkbench
} from "$runtime/client/storage/types";
import { EMPTY, STORAGE_VERSION } from "$runtime/client/storage/types";

/**
 * Turning stored text into a document, and back.
 *
 * Pure: no DOM, no `$app/*`, no runes. That is what lets it be tested directly
 * under the node environment, and it is the half of storage where every decision
 * actually lives — the browser half is two lines around `localStorage`.
 *
 * **Nothing here throws.** What comes back is whatever was in the store last
 * time, which may have been written by an older build, edited by hand, or
 * corrupted. Absent and malformed are deliberately the same case: both mean
 * "start from defaults", and the next write repairs the store because the whole
 * document is rewritten each time.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A pixel width that is worth believing.
 *
 * Sanity only, not policy — the panel's minimum and maximum belong to the
 * component that enforces the drag, and clamping to them here would put the same
 * number in two places. This rejects what cannot be a width at all: `NaN`,
 * `Infinity`, negatives, fractions, and values no display could justify.
 */
const width = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000
    ? value
    : fallback;

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const preferences = (value: unknown): PersistedPreferences | undefined => {
  if (!isObject(value)) return undefined;
  return {
    contextWidth: width(value.contextWidth, 0),
    contextCollapsed: flag(value.contextCollapsed, false),
    inspectorWidth: width(value.inspectorWidth, 0),
    inspectorCollapsed: flag(value.inspectorCollapsed, false)
  };
};

/**
 * A tab is two or three strings. Anything else is dropped rather than repaired:
 * a half-understood tab would open the wrong resource, which is worse than
 * opening none.
 */
const tab = (value: unknown): PersistedTab | undefined => {
  if (!Array.isArray(value)) return undefined;
  const [kind, id, activityId] = value as unknown[];
  if (typeof kind !== "string" || kind === "") return undefined;
  if (typeof id !== "string" || id === "") return undefined;
  if (activityId !== undefined && typeof activityId !== "string") return undefined;
  return activityId === undefined ? [kind, id] : [kind, id, activityId];
};

const workbench = (value: unknown): PersistedWorkbench | undefined => {
  if (!isObject(value)) return undefined;

  const tabs = Array.isArray(value.tabs)
    ? (value.tabs.map(tab).filter(Boolean) as PersistedTab[])
    : [];

  const activeTab = tab(value.active);
  // `active` is a pair, so a three-element value is not one — take the ref only.
  const active = activeTab ? ([activeTab[0], activeTab[1]] as const) : undefined;

  return { tabs, active };
};

/**
 * Reads a stored document.
 *
 * A version mismatch discards everything rather than migrating part of it.
 * Half-migrated state is harder to reason about than none, and the cost of
 * discarding is that a user re-drags a panel once.
 */
export const decode = (stored: string | null | undefined): PersistedClient => {
  if (typeof stored !== "string" || stored === "") return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return EMPTY;
  }

  if (!isObject(parsed) || parsed.v !== STORAGE_VERSION) return EMPTY;

  return {
    v: STORAGE_VERSION,
    preferences: preferences(parsed.preferences),
    workbench: workbench(parsed.workbench)
  };
};

/** Writes a document. Undefined sections are omitted rather than stored as null. */
export const encode = (document: PersistedClient): string =>
  JSON.stringify({
    v: STORAGE_VERSION,
    ...(document.preferences ? { preferences: document.preferences } : {}),
    ...(document.workbench ? { workbench: document.workbench } : {})
  });
