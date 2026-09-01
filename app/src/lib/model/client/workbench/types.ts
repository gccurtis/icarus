import type { GeneralResourceType } from "$revisions/types/resource";
import type { ResourceRuntime } from "$model/client/resource-runtimes";

/**
 * Workbench — what is open, which one is active, and everything a tab holds.
 *
 * The coordinating state every zone reads and writes. The tab strip renders it,
 * the work surface fills from it, and the context and inspector panels are
 * projections over it rather than objects of their own.
 *
 * Nothing here names a Svelte component, and nothing here holds a vocabulary the
 * views own. A context id and an inspection key are **opaque labels**: the model
 * remembers one per tab and never interprets it, and the view that renders the
 * rail or the inspector decides what it means. That is what stops this object
 * growing a fifty-member union every time a screen arrives.
 */

export type TabId = string;

/** A screen that is one per project and always open. */
export const SINGLETON_SCREENS = [
  "project-overview",
  "research",
  "analysis",
  "context",
  "templates",
  "personas",
  "automations"
] as const;

export type SingletonScreen = (typeof SINGLETON_SCREENS)[number];

/**
 * Every screen a tab can show: the seven singletons, the three editable
 * resources, and the launcher.
 *
 * `ScreenKind` is the discriminant on `viewState`, and `target.kind` narrows to
 * it — the two always agree, which `adoptTarget` establishes at mint.
 */
export type ScreenKind = SingletonScreen | GeneralResourceType | "new-tab";

/**
 * What a tab points at. **Identity is the only axis a target expresses.**
 *
 * Research and analysis are singletons rather than id-bearing tabs, and that is
 * the correction worth stating plainly: each has its own internal selection — an
 * investigation, an analysis — exactly as a deck selects a slide. That belongs in
 * view state. A tab per investigation would make the strip the navigation for a
 * screen that already has its own.
 */
export type TabTarget =
  | { readonly kind: "singleton"; readonly screen: SingletonScreen }
  | {
      readonly kind: "resource";
      readonly resourceType: GeneralResourceType;
      readonly resourceId: string;
    }
  | { readonly kind: "launcher" };

/**
 * The shell's own per-tab geometry, and the rail position.
 *
 * **Values only.** The minimum, the maximum, and the width below which a drag
 * collapses rather than clamps all belong to the panel component that enforces
 * the drag — it is the thing that knows a gesture overshot. Storing a bound here
 * would put the same number in two places.
 *
 * `contextId` is the one optional member, and deliberately so. It is an opaque
 * label the model never reads, and which context a screen kind defaults to is
 * the context panel's knowledge rather than this object's — so a freshly minted
 * tab has no rail position until either the user picks one or the panel resolves
 * its own default. Absent means "the view's default", which is the only answer
 * this object could honestly give.
 */
export type Frame = {
  contextId?: string;
  contextCollapsed: boolean;
  /**
   * Pixels, and the **content portion only** — the context panel's icon rail is
   * structural, never resizes, and never collapses, so it is not part of this
   * number. Storing the total instead would oblige every reader to remember to
   * subtract the rail, which is an off-by-44 waiting to happen.
   */
  contextWidth: number;
  inspectorCollapsed: boolean;
  /** Pixels. The inspector has no rail, so this is its whole width. */
  inspectorWidth: number;
};

/**
 * The geometry a tab is minted with.
 *
 * Frozen, and not merely by convention. `$state(DEFAULT_FRAME)` instead of
 * `$state({ ...DEFAULT_FRAME })` would wrap this constant in a reactive proxy,
 * so a deep write would reach every later reader — a leak that typechecks,
 * passes review, and works perfectly with one user. Freezing turns that into an
 * immediate throw at the write.
 *
 * The two widths also appear in `routes/app/[project]/+layout.svelte` as CSS
 * custom properties, because something has to paint before this object is
 * consulted. The layout reads them from here, so these are the source and the
 * CSS is the seed.
 */
export const DEFAULT_FRAME: Readonly<Frame> = Object.freeze({
  contextCollapsed: false,
  contextWidth: 276,
  inspectorCollapsed: false,
  inspectorWidth: 320
});

/**
 * What the user is looking at, as a namespaced label and nothing more —
 * `block.text-selection`, `document.page`, `copilot.tool-call`.
 *
 * **Opaque here, exactly as `contextId` is.** The inspector routes on the prefix
 * before the dot and reads the detail from view state, or for the copilot family
 * from the copilot object, since those belong to no tab. The vocabulary lives in
 * `views/inspector/`.
 *
 * It carried a payload before — `block.text-selection` held `{ blockId, from,
 * to }` — and that was a second record of what the user has selected, beside the
 * one already in `viewState.selection`. The ancestry array went with it: it
 * existed so the inspector could render a breadcrumb, and a screen derives that
 * from its own view state, which is where the structure it would be walking
 * already lives.
 *
 * **Not persisted**, when persistence returns. A key is trivially serialisable
 * but only meaningful if what it points at survives too, and the detail is
 * exactly the class of thing deliberately dropped. An inspector that opens empty
 * after a reload is the honest report of what the client actually knows.
 */
export type InspectionKey = string;

/** A text position, as the editor reports it. */
export type Selection = { readonly anchor: number; readonly head: number };

/**
 * The screen's whole typed working state, one arm per screen kind.
 *
 * Not the selected context — that is one field, two levels down, in `frame`.
 *
 * Called `viewState` and not `state` because four different things in this
 * object are state, and the ambiguity cost more than the four extra characters.
 *
 * The arms are deliberately thin. Every screen but the document is a placeholder
 * today, and inventing fields for one that does not exist is how a screen
 * inherits state it never wanted.
 */
export type WorkbenchViewState =
  | { kind: "project-overview"; frame: Frame }
  | { kind: "research"; frame: Frame; investigationId?: string }
  | { kind: "analysis"; frame: Frame; analysisId?: string }
  | { kind: "context"; frame: Frame }
  | { kind: "templates"; frame: Frame; mode?: string }
  | { kind: "personas"; frame: Frame; personaId?: string }
  | { kind: "automations"; frame: Frame; automationId?: string }
  | {
      kind: "document";
      frame: Frame;
      zoom: number;
      findQuery: string;
      scrollAnchor?: string;
      selection?: Selection;
    }
  | { kind: "slides"; frame: Frame; zoom: number; slideId?: string }
  | { kind: "spreadsheet"; frame: Frame; sheetId?: string; selection?: Selection }
  | { kind: "new-tab"; frame: Frame; query: string };

/** The view state arm belonging to one screen kind. */
export type ViewStateFor<K extends ScreenKind> = Extract<WorkbenchViewState, { kind: K }>;

/** What `update` accepts: any of a screen's own fields, never `kind` or `frame`. */
export type ViewStatePatch<K extends ScreenKind> = Partial<Omit<ViewStateFor<K>, "kind" | "frame">>;

export type Tab = {
  readonly id: TabId;
  readonly target: TabTarget;
  viewState: WorkbenchViewState;
  inspected?: InspectionKey;
};

/**
 * Whether a tab is always open.
 *
 * **A derivation, not a stored field.** Every singleton is permanent, so
 * permanence is not an independent fact about a tab — it is what its target is.
 * A boolean beside it would be a second answer that can disagree with the first.
 *
 * You do not close a singleton any more than you close project overview; not
 * being on one *is* closing it.
 *
 * Exported because five surfaces ask the same question — `close` and `reorder`
 * refuse one, `closeAll` keeps only those, the tab strip offers no close
 * affordance for one, and the `tab.close` command greys itself out on one —
 * and five spellings of one predicate is four chances to get it wrong.
 */
export const isPermanent = (tab: Tab): boolean => tab.target.kind === "singleton";

/**
 * Which screen a target shows.
 *
 * The bridge between the two axes: a target expresses identity, a screen kind
 * expresses what renders. `adoptTarget` uses it to build the matching view state
 * arm, and the work surface uses it to resolve a component — which is why it is
 * here rather than inside `methods/`, where a view could not reach it.
 */
export const screenKindOf = (target: TabTarget): ScreenKind => {
  switch (target.kind) {
    case "singleton":
      return target.screen;
    case "resource":
      return target.resourceType;
    case "launcher":
      return "new-tab";
  }
};

/**
 * The object every client feature touches.
 *
 * Three surfaces that were separate objects fold in here: the context rail, the
 * inspector, and panel geometry. All three read and wrote the active tab, and
 * being handed a workbench at construction was the tell.
 *
 * One thing folds back out: a live resource runtime was a field on `Tab`, and it
 * belongs to [a register](../document-runtimes/document-runtimes.md) per
 * resource now.
 */
export type WorkbenchModel = {
  /** Singletons first, then closable tabs in user order. */
  readonly tabs: readonly Tab[];
  /** Never empty: a singleton cannot be closed, so one always remains. */
  readonly activeId: TabId;
  readonly active: Tab;
  /** The reopen queue, most recently closed first. Capped at ten. */
  readonly closed: readonly Tab[];

  /** Returns the tab already open on this target, or mints one. Activates either way. */
  open(target: TabTarget): Tab;
  /**
   * Turns a launcher into the thing it created, keeping the same `TabId` and
   * slot — or, when the target is already open elsewhere, activates that tab and
   * closes the launcher.
   */
  resolveLauncher(id: TabId, target: TabTarget): Tab;
  /** Throws for a singleton — the UI must not offer to close one. */
  close(id: TabId): void;
  /** Clears to the singletons. Releases every runtime; does not persist. */
  closeAll(): void;
  activate(id: TabId): void;
  /** `index` counts closable tabs only, since singletons have no index. */
  reorder(id: TabId, index: number): void;
  /** Reopens the most recently closed tab, restoring its view state with it. */
  reopenClosed(): Tab | undefined;

  /**
   * Patches one screen's own view state.
   *
   * The kind is an argument because a patch against an eleven-arm union cannot
   * be narrowed from the patch itself, and the alternative is a cast — which is
   * exactly how a document's `zoom` ends up on a persona library. Restating it
   * makes the narrowing sound at compile time and a wrong caller a thrown error
   * rather than a corrupted tab.
   */
  update<K extends ScreenKind>(id: TabId, kind: K, patch: ViewStatePatch<K>): void;

  /** Records the active tab's rail position. The label is never interpreted. */
  selectContext(id: string): void;

  /** What the active tab has under inspection, or undefined for nothing. */
  readonly inspectedNode: InspectionKey | undefined;
  /** Replaces the active tab's inspection. Passing nothing clears it. */
  inspect(key?: InspectionKey): void;

  /** The active tab's frame. */
  readonly frame: Frame;
  /** Records geometry on the active tab. Values only; bounds are the panel's. */
  resize(patch: Partial<Omit<Frame, "contextId">>): void;

  /**
   * The resource runtime for a tab, or `undefined` for a tab that is not a
   * resource.
   *
   * The **only** way a view reaches one. The workbench borrows the register,
   * calls `attach` as part of opening a resource tab and `release` as part of
   * closing one, and hands the result out here. A view calling `attach` itself
   * would tie runtime lifetime to a component's mount, which is the case the
   * whole design exists to prevent — the work surface remounts on every tab
   * switch.
   */
  runtimeFor(id: TabId): ResourceRuntime<unknown> | undefined;
};

/**
 * The singletons, minted in this order, and the first is the one a fresh client
 * instance opens on.
 *
 * Built in the constructor rather than restored, which is what makes "`activeId`
 * is never empty" an invariant rather than a hope.
 */
export const SINGLETON_TARGETS: readonly TabTarget[] = Object.freeze(
  SINGLETON_SCREENS.map((screen) => Object.freeze({ kind: "singleton" as const, screen }))
);
