/**
 * What survives a reload, as it is written.
 *
 * Plain data, importing nothing. The objects that persist depend on these types;
 * these depend on nothing, which is what stops a storage format quietly
 * acquiring a dependency on a domain type that then cannot change without
 * invalidating everyone's saved state.
 *
 * That direction is why a persisted tab carries a bare `string` kind rather than
 * a `ResourceKind`: the stored value is whatever was written last time, possibly
 * by an older build, and treating it as a current domain type would be a lie the
 * compiler cannot catch.
 */

export const STORAGE_KEY = "icarus.client";

/**
 * Bumped when a shape changes incompatibly. A mismatch discards rather than
 * migrating — this is a cache of panel widths and open tabs, so being wrong
 * costs one re-drag, and migration code for it would outlive its usefulness.
 */
export const STORAGE_VERSION = 1;

/** Panel geometry. Values only; the bounds belong to the components. */
export type PersistedPreferences = {
  readonly contextWidth: number;
  readonly contextCollapsed: boolean;
  readonly inspectorWidth: number;
  readonly inspectorCollapsed: boolean;
};

/**
 * One open tab, as `[kind, id]` plus the activity its rail was on.
 *
 * Positional because this is the part that grows, and a tab list of objects
 * spends most of its bytes on repeated key names.
 *
 * **No session id.** Ids are minted by a counter, so a stored one is meaningless
 * on the next boot — and worse, a restored `session-1` colliding with a freshly
 * minted `session-1` makes lookups return the wrong tab. Restoring replays the
 * resource ref through `open()` instead, which is the same path a click takes.
 */
export type PersistedTab = readonly [kind: string, id: string, activityId?: string];

export type PersistedWorkbench = {
  readonly tabs: readonly PersistedTab[];
  /** A ref rather than an index, so a dropped tab cannot silently activate its neighbour. */
  readonly active?: readonly [kind: string, id: string];
};

export type PersistedClient = {
  readonly v: number;
  readonly preferences?: PersistedPreferences;
  readonly workbench?: PersistedWorkbench;
};

/** An empty document — what an absent, corrupt, or outdated store resolves to. */
export const EMPTY: PersistedClient = Object.freeze({ v: STORAGE_VERSION });
