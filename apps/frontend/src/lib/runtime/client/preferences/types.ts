/**
 * Panel geometry the shell remembers between visits.
 *
 * **Values only.** The minimum, the maximum, and the width below which a drag
 * collapses rather than clamps all belong to the panel component that enforces
 * the drag — it is the thing that knows a gesture overshot. Storing a bound here
 * as well would put the same number in two places, which is how the three copies
 * this refactor removes came to exist.
 */
export type Panels = {
  /**
   * Pixels, and the **content portion only** — the context panel's icon rail is
   * structural, never resizes, and never collapses, so it is not part of this
   * number. The panel's total is this plus the rail. Storing the total instead
   * would oblige every reader to remember to subtract the rail, which is an
   * off-by-44 waiting to happen.
   */
  contextWidth: number;
  contextCollapsed: boolean;
  /** Pixels. The inspector has no rail, so this is its whole width. */
  inspectorWidth: number;
  inspectorCollapsed: boolean;
};

/**
 * What the shell remembers.
 *
 * Deliberately the lighter of the two stateful objects. Tab state dies with the
 * tab; this outlives every tab, which is the test for what belongs here. A user
 * who sized the inspector once expects it sized in the next tab too — the
 * alternative makes panels jump on every switch.
 *
 * Theme and the semantic-set choice join `panels` here when they are built. They
 * are settings in the ordinary sense, which is why this is `preferences` and why
 * the mutator is `set` rather than a verb implying observation.
 */
export interface PreferencesRuntime {
  readonly panels: Panels;
  set(patch: Partial<Panels>): void;
}

/**
 * Frozen, and not merely by convention.
 *
 * `$state(DEFAULTS)` instead of `$state({ ...DEFAULTS })` would wrap this
 * constant itself in the reactive proxy, so a deep write would reach every later
 * reader — a leak that typechecks, passes review, and works perfectly with one
 * user. Freezing turns that into an immediate throw at the write.
 *
 * The two widths also appear in `routes/app/+layout.svelte` as CSS custom
 * properties, because something has to paint before this object is consulted.
 * The layout reads them from here, so these are the source and the CSS is the
 * seed.
 */
export const DEFAULTS: Readonly<Panels> = Object.freeze({
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false
});
