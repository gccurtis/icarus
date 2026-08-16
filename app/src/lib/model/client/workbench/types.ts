/**
 * Workbench — what is open, which one is active, and everything a tab holds.
 *
 * The coordinating state every zone reads and writes. The tab strip renders it,
 * the work surface fills from it, and the context and inspector panels are
 * projections over it rather than objects of their own.
 *
 * Named for the frame rather than for tabs, because the tab list is only its
 * most visible part — `session` collided with an authentication session.
 *
 * Nothing here names a Svelte component. Every view-facing value is a stable
 * key, and the view that renders the result resolves it — the workspace maps
 * `ResourceKind`, the context panel maps `ContextId`. There is no registry
 * directory and no shared map file; see
 * [the view standard](../../../../../docs/view-directory/view-directory.md).
 * A model type naming a component points the dependency backwards and drags a
 * DOM into every test of this object.
 */

export type TabId = string;

/**
 * The resource kinds a tab can hold, as a value.
 *
 * A value rather than only a type because stored state has to be checked against
 * it at runtime: a tab restored from an older build can name a kind that no
 * longer exists, and `CONTEXTS_BY_KIND` is a `Record<ResourceKind, …>`, so an
 * unknown kind resolves to `undefined` and throws during paint. The type is
 * derived from the value, so the two cannot drift.
 *
 * Adding a member forces every surface that switches on kind to handle it, which
 * is the point of the union.
 */
export const RESOURCE_KINDS = ["project-overview", "document"] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const isResourceKind = (value: string): value is ResourceKind =>
  (RESOURCE_KINDS as readonly string[]).includes(value);

/**
 * A resource is identified by kind *and* id — the id alone is not unique across
 * kinds, and `open()` matches on both.
 */
export type ResourceRef = {
  kind: ResourceKind;
  id: string;
};

/**
 * The context panel's rail positions, as values, for the same reason resource
 * kinds are values: a stored id can outlive the context it named.
 *
 * A context is a way of looking at what surrounds the active resource — its
 * outline, what it relates to, who commented on it. Not a mode of working: a
 * rail entry answers "what else is here?", never "what am I doing?", which is
 * why these are contexts rather than activities.
 */
export const CONTEXT_IDS = ["overview", "outline"] as const;

/**
 * Stable identity, and the whole of what this object exposes about a context.
 * A label and an icon are display copy: rewording or translating either must not
 * change what a tab points at, so both belong to the view that renders the rail.
 */
export type ContextId = (typeof CONTEXT_IDS)[number];

export const isContextId = (value: string): value is ContextId =>
  (CONTEXT_IDS as readonly string[]).includes(value);

/**
 * What each resource kind's rail offers, first entry first.
 *
 * Static vocabulary about resource kinds, which is why it sits beside
 * `RESOURCE_KINDS` rather than in a file of its own: what a kind offers is a
 * property of that kind, not something assembled at runtime.
 *
 * `Record<ResourceKind, …>` rather than a partial map, so adding a resource kind
 * fails to compile until it has been given a rail. A kind reaching the panel
 * with no contexts has no way to render, and finding that at runtime is strictly
 * worse than finding it at build time.
 *
 * The first entry of each array is that kind's default — what the rail shows
 * before the user has chosen, and what it falls back to when a tab points at a
 * context the kind no longer offers. A context may be shared between kinds by
 * listing it in several arrays, which `overview` is.
 */
export const CONTEXTS_BY_KIND: Record<ResourceKind, readonly ContextId[]> = Object.freeze({
  "project-overview": Object.freeze(["overview"] as const),
  document: Object.freeze(["outline", "overview"] as const)
});

/**
 * One thing that can be inspected.
 *
 * The union is global rather than namespaced per resource kind, but most members
 * end up resource-qualified anyway: selected text in a document is not the same
 * object as selected text in a spreadsheet, and they want different inspector
 * views. The members that are genuinely shared — `formula`, `prompt` — stay
 * unqualified, because the server treats those as capabilities in their own
 * right rather than as document internals, and one view serves both.
 */
export type InspectionNode =
  /**
   * The caret rests somewhere with nothing to inspect yet — a new line. A named
   * state rather than an absent one, because the inspector can still offer
   * insert affordances here, which is exactly when it is most useful.
   */
  | { readonly kind: "empty" }
  /**
   * Text about to be typed. This is the case that shows the inspector is a
   * control surface rather than a mirror: what the user sets here — bold, a
   * style — is what the editor applies to each subsequent keypress, and none of
   * that typing changes the inspection.
   */
  | { readonly kind: "document-next-text"; readonly blockId: string }
  | {
      readonly kind: "document-text-selection";
      readonly blockId: string;
      readonly from: number;
      readonly to: number;
    }
  | { readonly kind: "document-table"; readonly tableId: string }
  | { readonly kind: "formula"; readonly formulaId: string }
  | { readonly kind: "prompt"; readonly promptId: string };

/**
 * An inspection ancestry, outermost first and innermost last.
 *
 * Selected text inside a table inside a document is one caret position with
 * three plausible targets. The inspector shows the innermost by default and the
 * ancestry is what makes one step outward reachable.
 */
export type Inspection = readonly InspectionNode[];

/**
 * Panel geometry. **Values only.** The minimum, the maximum, and the width below
 * which a drag collapses rather than clamps all belong to the panel component
 * that enforces the drag — it is the thing that knows a gesture overshot.
 * Storing a bound here as well would put the same number in two places.
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
 * The geometry a tab has until it is resized, and the fallback behind
 * `panels`.
 *
 * Frozen, and not merely by convention. `$state(DEFAULTS)` instead of
 * `$state({ ...DEFAULTS })` would wrap this constant itself in a reactive proxy,
 * so a deep write would reach every later reader — a leak that typechecks,
 * passes review, and works perfectly with one user. Freezing turns that into an
 * immediate throw at the write.
 *
 * The two widths also appear in `routes/app/[project]/+layout.svelte` as CSS
 * custom properties, because something has to paint before this object is
 * consulted. The layout reads them from here, so these are the source and the
 * CSS is the seed.
 */
export const DEFAULTS: Readonly<Panels> = Object.freeze({
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false
});

/** Per-tab view state. */
export type TabOptions = {
  /**
   * What this tab has under inspection.
   *
   * Set only by an explicit `inspect()` call, never derived from focus. That is
   * what lets it hold: clicking into the inspector blurs the editor and
   * collapses the caret, and an inspection derived from focus would empty the
   * panel the user is reaching for.
   *
   * Not persisted — it names block ids and character offsets in a document that
   * may have changed since.
   */
  inspection?: Inspection;
  /** Not persisted, for the same reason. */
  scrollTop?: number;
  /** The rail position this tab was last on, so each tab keeps its own. */
  contextId?: ContextId;
  /**
   * This tab's panel geometry, absent until the tab is resized.
   *
   * Absent rather than defaulted, so a tab nobody dragged stores nothing and
   * follows a later change to `DEFAULTS`. `panels` reads
   * `active.options.panels ?? DEFAULTS`.
   */
  panels?: Panels;
};

export type Tab = {
  readonly id: TabId;
  readonly resource: ResourceRef;
  /**
   * Permanent tabs are always open: they cannot be closed and cannot be
   * reordered. They hold the leading positions, so the transient ones a user can
   * drag are always a contiguous run at the end.
   */
  readonly permanent: boolean;
  options: TabOptions;
};

/**
 * The object every client feature touches.
 *
 * Three surfaces that were separate objects fold in here: the context rail, the
 * inspector, and panel geometry. All three read and wrote the active tab, and
 * being handed a workbench at construction was the tell.
 */
export type WorkbenchModel = {
  /** Permanent tabs first, then transient ones in user order. */
  readonly tabs: readonly Tab[];
  /** Never empty: a permanent tab cannot be closed, so one always remains. */
  readonly activeId: TabId;
  readonly active: Tab;

  /** Returns the existing tab when kind+id already match one, and activates it. */
  open(resource: ResourceRef): Tab;
  /** Throws for a permanent tab — the UI must not offer to close one. */
  close(id: TabId): void;
  activate(id: TabId): void;
  /** `index` counts transient tabs only, since permanent ones have no index. */
  reorder(id: TabId, index: number): void;
  update(id: TabId, patch: Partial<TabOptions>): void;

  /** Contexts for the active tab's resource kind. Static per kind. */
  readonly availableContexts: readonly ContextId[];
  /** The tab's remembered context, or the kind's first when none is valid. */
  readonly activeContext: ContextId;
  /** Records the choice on the active tab, so each keeps its own rail position. */
  selectContext(id: ContextId): void;

  /**
   * The innermost node of the active tab's inspection — what the inspector shows
   * by default. Undefined when nothing is inspected, which is the panel's cue to
   * render the nothing-inspected view: that state has no node to hand a view, so
   * pretending otherwise would mean every view defending against a node that
   * isn't there. The ancestry above it is `active.options.inspection`.
   */
  readonly currentInspection: InspectionNode | undefined;
  /** Replaces the active tab's inspection. Passing nothing clears it. */
  inspect(inspection?: Inspection): void;

  /** The active tab's geometry, or `DEFAULTS` while it has none of its own. */
  readonly panels: Panels;
  /** Records geometry on the active tab. Values only; bounds are the panel's. */
  resize(patch: Partial<Panels>): void;
};

/**
 * The one permanent tab. It is constructed with the workbench, which is what
 * makes "activeId is never empty" an invariant rather than a hope.
 *
 * The id is fixed rather than the project's, because a client instance holds one
 * project for its whole life and a second project is a second instance with its
 * own storage key. Nothing distinguishes two overviews inside one workbench.
 */
export const PROJECT_OVERVIEW: ResourceRef = Object.freeze({
  kind: "project-overview",
  id: "project-overview"
});
