/**
 * Session — one open tab, and the state that belongs to it alone.
 *
 * A session is the unit the tab strip renders and the work surface fills. What
 * survives a tab switch is workspace state and lives in that capability; what
 * dies with the tab lives here.
 */

export type SessionId = string;

/**
 * What a session can hold. A resource is identified by kind *and* id — the id
 * alone is not unique across kinds, and `open()` matches on both.
 *
 * Adding a member here forces every surface that switches on kind to handle it,
 * which is the point of the union.
 */
export type ResourceKind = "project-overview";

export type ResourceRef = {
  kind: ResourceKind;
  id: string;
};

/**
 * One thing that can be inspected.
 *
 * The union is global rather than namespaced per resource kind, but most
 * members end up resource-qualified anyway: selected text in a document is not
 * the same object as selected text in a spreadsheet, and they want different
 * inspector views. The members that are genuinely shared — `formula`, `prompt`
 * — stay unqualified, because the backend treats those as capabilities in their
 * own right rather than as document internals, and one view serves both.
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
   * that typing changes the inspection. Pending format state belongs on this
   * node once the document capability defines it.
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
 * ancestry is what makes one step outward reachable — the default view answers
 * the common question, one step reaches the supporting material.
 */
export type Inspection = readonly InspectionNode[];

/** Per-tab view state. Everything here is forgotten when the tab closes. */
export type SessionOptions = {
  /**
   * What this tab has under inspection.
   *
   * Changes on discrete acts — placing a caret, selecting a range, clicking
   * into a table — never on typing. The inspector is a control surface rather
   * than a mirror of the caret: set "next text" to bold and every subsequent
   * keypress *consults* this inspection without altering it.
   *
   * Set only by an explicit `inspect()` call, never derived from focus. That is
   * what lets it hold: clicking into the inspector blurs the editor and
   * collapses the caret, and an inspection derived from focus would empty the
   * panel the user is reaching for.
   */
  inspection?: Inspection;
  scrollTop?: number;
  /**
   * Id of the context panel activity this tab was last on, so each tab keeps
   * its own rail position.
   *
   * Typed as a bare string rather than importing the context capability's
   * `ActivityId`: session is the lower layer, and a panel must be able to
   * depend on it without it depending back.
   */
  activityId?: string;
};

export type Session = {
  readonly id: SessionId;
  readonly resource: ResourceRef;
  /**
   * Permanent sessions are always open: they cannot be closed and cannot be
   * reordered. They hold the leading positions in `sessions`, so the transient
   * ones a user can drag are always a contiguous run at the end.
   */
  readonly permanent: boolean;
  options: SessionOptions;
};

export type SessionRuntime = {
  /** Permanent sessions first, then transient ones in user order. */
  readonly sessions: readonly Session[];
  /** Never empty: a permanent session cannot be closed, so one always remains. */
  readonly activeId: SessionId;
  readonly active: Session;

  /** Returns the existing session when kind+id already match one, and activates it. */
  open(resource: ResourceRef): Session;
  /** Throws for a permanent session — the UI must not offer to close one. */
  close(id: SessionId): void;
  activate(id: SessionId): void;
  /** `index` counts transient sessions only, since permanent ones have no index. */
  reorder(id: SessionId, index: number): void;
  update(id: SessionId, patch: Partial<SessionOptions>): void;
};

/**
 * The one permanent session. It is constructed with the runtime, which is what
 * makes "activeId is never empty" an invariant rather than a hope.
 *
 * The id is fixed because there is no project concept yet. When there is, this
 * becomes one overview per project and the id becomes the project's.
 */
export const PROJECT_OVERVIEW: ResourceRef = {
  kind: "project-overview",
  id: "project-overview",
};
