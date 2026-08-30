import type { Screen, Subscreen } from "$model/client/view-state/methods/shared/keys";
import type { ContextId, InspectionKey } from "$model/client/view-state/methods/shared/panel-keys";

/**
 * What a person has open, and what they are looking at inside it.
 *
 * Screens are generated from the workspace tree in
 * [`keys.ts`](methods/shared/keys.ts); panels are hand-written in
 * [`panel-keys.ts`](methods/shared/panel-keys.ts). This module holds only the
 * shapes that are decisions rather than inventory.
 */

/** A tab's identity for this browser tab's lifetime. Never persisted. */
export type TabId = string;

/**
 * What the inspector is showing.
 *
 * `"empty"` belongs here rather than in the generated keys: nothing selected is
 * a state the application has, not a file in the tree. Every other member is a
 * lens.
 */
export type Inspected = InspectionKey | "empty";

/**
 * What is picked out inside the centre.
 *
 * **The key never carries the detail.** An inspection key is a namespaced label
 * and nothing more; what it is about lives here, once, so there is a single
 * record of what the user has selected.
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
 * `screen` and `subscreen` together name the centre: `agents` + `persona`
 * resolves to `workspaces/agents/workspace-persona.svelte`, and a screen with
 * one centre has the single subscreen `workspace`.
 *
 * **A subscreen is view state, never a second tab.** The Agents screen on its
 * library and on one persona are one tab in two states.
 *
 * **Three fields name a subject, and each answers a different question.**
 * `resourceId` is what the tab is *for* and is fixed at mint, so two documents
 * are two tabs and one document reached three ways is one. `focus` is what the
 * centre is currently *about*, and is writable, so a permanent tab can move
 * between personas without minting anything. `selection` is what is picked out
 * *inside* the centre, and drives the inspector.
 *
 * Which of the first two a subject gets is the decision that shapes a screen: a
 * thing you open, work in and close earns a tab, and a thing you switch between
 * inside one screen earns a focus.
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
   * rather than a gap to paper over: the slide deck's layout rail hangs on no
   * subscreen, and inventing a position for it would hide that.
   */
  contextId: ContextId | undefined;
  /** What the centre is about. Undefined on a screen showing a library. */
  focus?: string;
  inspected: Inspected;
  selection?: Selection;
  frame: Frame;
};

/** What a tab is opened onto. */
export type Target = {
  readonly screen: Screen;
  readonly subscreen?: Subscreen;
  readonly resourceId?: string;
  /** What the centre should be about on arrival. See `Tab.focus`. */
  readonly focus?: string;
};

/**
 * The screens that are one per project and always open.
 *
 * Permanence is derived rather than stored — `SINGLETONS.includes(tab.screen)` —
 * which removes the one place a boolean and a screen could disagree. You do not
 * close one any more than you close Project Overview.
 *
 * Each is a *place*: somewhere the project's work of one kind is gathered, and
 * somewhere you return to rather than arrive at. A screen that holds one
 * identified thing at a time is not one of these; it is a tab keyed by that
 * thing. Research and Analysis are the cases that make the line visible — a line
 * of enquiry and a chart are each opened, worked in and closed, and two of
 * either are two tabs, so neither screen is a place you return to.
 *
 * Templates and Agents are, and the difference is what they open on: a library
 * of everything of that kind, from which you choose one. An analysis has no such
 * library in the centre — the list of them is a rail entry, because choosing
 * which chart to look at is navigation.
 */
/*
 * The order is the strip's order, and it runs from the project outward: where
 * you are, then what is working, then what it works from.
 */
export const SINGLETONS = [
  "project-overview",
  "agents",
  "templates"
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

  /** The permanent screens first, then what the person opened, in their order. */
  readonly tabs: readonly Tab[];
  readonly activeId: TabId;
  /** The reopen queue, newest first, capped at ten. Whole tabs, not identities. */
  readonly closed: readonly Tab[];

  /** Never undefined: a permanent tab cannot be closed, so one always remains. */
  readonly active: Tab;
  readonly frame: Frame;
  /** The rail position, or this subscreen's default if it has drifted. */
  readonly context: ContextId | undefined;
  readonly inspected: Inspected;
  readonly selection: Selection | undefined;

  open(target: Target): Tab;
  activate(id: TabId): void;
  /** Throws for a permanent screen, because not being on one *is* closing it. */
  close(id: TabId): void;
  reopenClosed(): Tab | undefined;

  /** Switch the centre, and say what it is about where that is a thing. */
  showSubscreen(subscreen: Subscreen, focus?: string): void;
  selectContext(id: ContextId): void;

  inspect(key: Inspected, selection?: Selection): void;
  clear(): void;

  resize(patch: Partial<Frame>): void;

  /** Whether the active tab is on a given centre right now. */
  showing(screen: Screen, subscreen?: Subscreen): boolean;
}
