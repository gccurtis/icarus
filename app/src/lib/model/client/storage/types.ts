/**
 * What survives a reload — the contract, and the shape it is written in.
 *
 * The stored discriminator is the current closed UI Category vocabulary. Reads
 * prove it again at the boundary; a stale or unknown value discards the whole
 * cache rather than entering the workbench as a partially understood tab.
 */
import type { Id } from "$representation/data/types/core/id";

/** Every project's key begins with this, so one prefix finds them all. */
export const STORAGE_KEY_PREFIX = "icarus.client";

/**
 * One key per project. Everything persisted is workbench state and a workbench
 * belongs to a project, so two projects share nothing and neither can grow the
 * other's document.
 */
export const storageKey = (project: string): string => `${STORAGE_KEY_PREFIX}.${project}`;

/**
 * Bumped when a shape changes incompatibly. A mismatch discards rather than
 * migrating — this is a cache of panel widths and open tabs, so being wrong
 * costs one re-drag, and migration code for it would outlive its usefulness.
 */
export const STORAGE_VERSION = 3;

/** Panel geometry. Values only; the bounds belong to the components. */
export type PersistedPanels = {
  readonly contextWidth: number;
  readonly contextCollapsed: boolean;
  readonly inspectorWidth: number;
  readonly inspectorCollapsed: boolean;
};

/**
 * The part of a tab's options that outlives the tab's session.
 *
 * Named rather than positional, unlike the ref beside it: this is the sparse
 * half. A tab that was never resized and never left the default context writes
 * nothing here at all, and a name costs bytes only when there is a value to
 * carry.
 */
export type PersistedTabOptions = {
  readonly contextId?: string;
  readonly panels?: PersistedPanels;
};

/**
 * One open tab, as `[kind, id]` plus whatever it remembers.
 *
 * The ref is positional because it is the part that repeats, and a tab list of
 * objects spends most of its bytes on the same two key names.
 *
 * **No session id.** Ids are minted by a counter, so a stored one is meaningless
 * on the next boot — and worse, a restored `tab-1` colliding with a freshly
 * minted `tab-1` makes lookups return the wrong tab. Restoring replays the
 * resource ref through `open()` instead, which is the same path a click takes.
 */
export type PersistedTabIdentity =
  | readonly [category: "document-editor", id: Id<"documents">]
  | readonly [category: "slide-deck-editor", id: Id<"slideDecks">]
  | readonly [category: "spreadsheet-editor", id: Id<"spreadsheets">]
  | readonly [category: "research", id: Id<"researchThreads">]
  | readonly [category: "analysis", id: string]
  | readonly [category: "project-overview", id: "project-overview"]
  | readonly [category: "agents", id: "agents"]
  | readonly [category: "templates", id: "templates"]
  | readonly [category: "new-tab", id: "new-tab"]
  | readonly [category: "context-editor", id: "context-editor"];

export type PersistedTab =
  | PersistedTabIdentity
  | readonly [...PersistedTabIdentity, options: PersistedTabOptions];

export type PersistedWorkbench = {
  readonly tabs: readonly PersistedTab[];
  /** A ref rather than an index, so a dropped tab cannot silently activate its neighbour. */
  readonly active?: PersistedTabIdentity;
};

/**
 * The whole document.
 *
 * One section, because panel geometry rides on a tab now and there is nothing
 * left that outlives every tab. A second section returns the day something is
 * persisted that is not workbench state.
 */
export type PersistedClient = {
  readonly v: typeof STORAGE_VERSION;
  readonly workbench?: PersistedWorkbench;
};

/** An empty document — what an absent, corrupt, or outdated store resolves to. */
export const EMPTY: PersistedClient = Object.freeze({ v: STORAGE_VERSION });

/**
 * What survives a reload, as a surface.
 *
 * Named `ClientStorage` rather than `Storage`, which is a DOM lib global —
 * `localStorage`'s own type. A local `Storage` interface shadows it inside its
 * own module and silently does *not* in any file that forgets to import ours,
 * which typechecks and means something else entirely.
 *
 * Typed sections rather than a stringly-keyed get/set, so the interface is
 * itself the list of what persists. There is one section, and the interface is
 * where that becomes visible.
 */
export interface ClientStorage {
  readonly workbench: PersistedWorkbench | undefined;
  saveWorkbench(value: PersistedWorkbench): void;
}

/** Where a write goes. A parameter, so a test can watch one without a DOM. */
export type Sink = (serialized: string) => void;
