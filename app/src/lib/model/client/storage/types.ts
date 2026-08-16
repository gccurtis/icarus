/**
 * What survives a reload — the contract, and the shape it is written in.
 *
 * Importing nothing. The objects that persist depend on these types;
 * these depend on nothing, which is what stops a storage format quietly
 * acquiring a dependency on a domain type that then cannot change without
 * invalidating everyone's saved state.
 *
 * That direction is why a persisted tab carries a bare `string` kind rather than
 * a `ResourceKind`: the stored value is whatever was written last time, possibly
 * by an older build, and treating it as a current domain type would be a lie the
 * compiler cannot catch. The same holds for a stored context id.
 */

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
 *
 * Version 2 was the first with panel geometry on the tab rather than in a
 * document-wide preferences section. Version 3 renamed a tab's remembered rail
 * position from `activityId` to `contextId`, which is a rename in the stored
 * document as much as in the code — discarding costs one rail position per tab,
 * which is exactly the kind of loss this policy exists to accept.
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
export type PersistedTab = readonly [kind: string, id: string, options?: PersistedTabOptions];

export type PersistedWorkbench = {
  readonly tabs: readonly PersistedTab[];
  /** A ref rather than an index, so a dropped tab cannot silently activate its neighbour. */
  readonly active?: readonly [kind: string, id: string];
};

/**
 * The whole document.
 *
 * One section, because panel geometry rides on a tab now and there is nothing
 * left that outlives every tab. A second section returns the day something is
 * persisted that is not workbench state.
 */
export type PersistedClient = {
  readonly v: number;
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
