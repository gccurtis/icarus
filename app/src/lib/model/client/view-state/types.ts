import type {
  ContextId,
  InspectionKey,
  Screen,
  Subscreen
} from "$model/client/view-state/methods/shared/keys";

/**
 * What a person has open, and what they are looking at inside it.
 *
 * The vocabulary is in [`keys.ts`](keys.ts) and is generated from the four panel
 * trees, so everything named here exists as a file. This module holds only the
 * shapes that are decisions rather than inventory.
 */

/** A tab's identity for this browser tab's lifetime. Never persisted. */
export type TabId = string;

/**
 * What the inspector is showing.
 *
 * `"empty"` is here rather than in the generated keys because nothing selected
 * is a state the application has, not a file in the tree. Every other member is
 * a lens.
 */
export type Inspected = InspectionKey | "empty";

/**
 * What is selected inside the centre.
 *
 * **The key never carries the detail.** An inspection key is a namespaced label
 * and nothing more; the thing it is about lives here, once. The two used to be
 * one — `block.text-selection` held `{ blockId, from, to }` — and that was a
 * second record of what the user had selected, beside the one already in view
 * state.
 */
export type Selection = {
  /** What kind of thing: `resource`, `comment`, `slide`, `cell`, `finding`. */
  readonly kind: string;
  readonly id: string;
  /** Where inside it, where that is meaningful: `C2`, `Slide 4`, a range. */
  readonly at?: string;
};

/**
 * The shell's own per-tab geometry.
 *
 * Every member is present from the moment a tab is minted — no optionality, so
 * no read path reports a default it never stored. The model holds values and
 * views hold bounds: a minimum, a maximum and a collapse threshold belong to the
 * panel that enforces the drag.
 */
export type Frame = {
  contextWidth: number;
  contextCollapsed: boolean;
  inspectorWidth: number;
  inspectorCollapsed: boolean;
};

/**
 * One tab.
 *
 * `screen` and `subscreen` together name the centre — `research` +
 * `one-question` resolves to `workspaces/research/workspace-one-question.svelte`.
 * A screen with one centre has the single subscreen `workspace`.
 *
 * **A subscreen is view state, never a second tab.** Research on one question and
 * Research on every thread are one tab in two states; a tab per investigation
 * would make the strip the navigation for a screen that already has its own.
 *
 * `resourceId` is present only where the screen edits an identified thing — a
 * document, a deck, a spreadsheet. It is what makes two document tabs two tabs.
 */
export type Tab = {
  readonly id: TabId;
  readonly screen: Screen;
  subscreen: Subscreen;
  readonly resourceId?: string;
  /**
   * Where the rail is. Always one this subscreen offers; see `rails.ts`.
   *
   * Undefined where the subscreen has no rail at all, which is a real state
   * rather than a gap to paper over: the specification gives the slide deck a
   * layout rail with no subscreen to hang it on, and inventing a position for it
   * would hide that.
   */
  contextId: ContextId | undefined;
  inspected: Inspected;
  selection?: Selection;
  frame: Frame;
};

/** What a tab is opened onto. */
export type Target = {
  readonly screen: Screen;
  readonly subscreen?: Subscreen;
  readonly resourceId?: string;
};

/**
 * The seven screens that are one per project and always open.
 *
 * Permanence is not a stored field: it is `SINGLETONS.includes(tab.screen)`,
 * which removes the one place a boolean and a screen could disagree. You do not
 * close one any more than you close Project Overview.
 */
export const SINGLETONS = [
  "project-overview",
  "research",
  "analysis",
  "context",
  "templates",
  "personas",
  "automations"
] as const satisfies readonly Screen[];

export type Singleton = (typeof SINGLETONS)[number];

export const isSingleton = (screen: Screen): screen is Singleton =>
  (SINGLETONS as readonly Screen[]).includes(screen);

/** Where a tab starts, before anything has been dragged. */
export const DEFAULT_FRAME: Frame = Object.freeze({
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false
});

/**
 * What is open, and what is being looked at inside it.
 *
 * One object, and the five shell surfaces are functions of it — the tab strip,
 * the context panel, the centre, the inspector and the status bar own almost
 * nothing between them and write back only through these methods.
 *
 * Named as a type rather than inferred from the constructor because the
 * consumers that matter have to name it: the composition root declaring what it
 * built, the test substituting one object, the surface taking it as a parameter.
 */
export interface ViewStateModel {
  /** The project this instance acts on. Read from the route once. */
  readonly project: string;

  /** Singletons first, then what the person opened, in their order. */
  readonly tabs: readonly Tab[];
  readonly activeId: TabId;
  /** The reopen queue, newest first, capped at ten. Whole tabs, not identities. */
  readonly closed: readonly Tab[];

  /** Never undefined: a singleton cannot be closed, so one always remains. */
  readonly active: Tab;
  readonly frame: Frame;
  /** The rail position, or this subscreen's default if it has drifted. */
  readonly context: ContextId | undefined;
  readonly inspected: Inspected;
  readonly selection: Selection | undefined;

  open(target: Target): Tab;
  activate(id: TabId): void;
  /** Throws for a singleton, because not being on one *is* closing it. */
  close(id: TabId): void;
  reopenClosed(): Tab | undefined;

  showSubscreen(subscreen: Subscreen): void;
  selectContext(id: ContextId): void;

  inspect(key: Inspected, selection?: Selection): void;
  clear(): void;

  resize(patch: Partial<Frame>): void;

  /** Whether the active tab is on a given centre right now. */
  showing(screen: Screen, subscreen?: Subscreen): boolean;
}
