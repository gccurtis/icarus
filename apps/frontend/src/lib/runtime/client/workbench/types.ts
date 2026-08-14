/**
 * Workbench — what is open, which one is active, and what is selected in each.
 *
 * The coordinating state every zone reads and writes. The tab strip renders it,
 * the work surface fills from it, and the context and inspector panels project
 * over it. What survives a tab switch lives in preferences; what dies with the
 * tab lives here.
 *
 * Named for the frame rather than for tabs, because the tab list is only its
 * most visible part — `session` collided with an authentication session.
 */

export type TabId = string;

/**
 * The resource kinds a tab can hold, as a value.
 *
 * A value rather than only a type because stored state has to be checked
 * against it at runtime: a tab restored from an older build can name a kind that
 * no longer exists, and `ACTIVITIES` is a `Record<ResourceKind, …>`, so an
 * unknown kind resolves to `undefined` and throws during paint. The type is
 * derived from the value, so the two cannot drift.
 *
 * Adding a member forces every surface that switches on kind to handle it, which
 * is the point of the union.
 */
export const RESOURCE_KINDS = ["project-overview"] as const;

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

/** Per-tab view state. Everything here is forgotten when the tab closes. */
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
  /**
   * Id of the context panel activity this tab was last on, so each tab keeps its
   * own rail position.
   *
   * A bare string rather than the activities object's `ActivityId`: workbench is
   * the lower layer, and a panel must be able to depend on it without it
   * depending back.
   */
  activityId?: string;
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

export type WorkbenchRuntime = {
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
};

/**
 * The one permanent tab. It is constructed with the runtime, which is what makes
 * "activeId is never empty" an invariant rather than a hope.
 *
 * The id is fixed because there is no project concept yet. When there is, this
 * becomes one overview per project and the id becomes the project's.
 */
export const PROJECT_OVERVIEW: ResourceRef = Object.freeze({
  kind: "project-overview",
  id: "project-overview"
});
