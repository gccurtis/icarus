import type { ContextId, Screen, Subscreen } from "$model/client/view-state/methods/shared/keys";

/**
 * Which context views a screen's rail offers, in order, and which one it opens on.
 *
 * **Written here rather than derived.** Nothing is inferred from the file tree: a
 * view can exist without a rail offering it, so a rail that disagrees with the
 * specification is changed in the specification first and copied down here after.
 * The first entry is that subscreen's default.
 *
 * Overview leads every rail but two — a deck's, where the list of slides is the
 * orientation instead, and Research's, where the list of threads is.
 */
export const RAILS: Record<Screen, Partial<Record<Subscreen, readonly ContextId[]>>> = {
  /**
   * Four, and every one of them is something the plane does *not* hold: what the
   * project is, what has happened, and the two vocabularies everything else is
   * built out of.
   *
   * Resources, people, tasks and health each have a band on the plane already, so
   * a panel for any of them would be the rail restating the screen beside it —
   * and a map that repeats the territory is not a map.
   */
  "project-overview": {
    workspace: ["overview.project", "project.history", "project.variables", "project.contexts"]
  },

  /**
   * A chart's own rail, because an analysis tab *is* one analysis — the same
   * shape as Research, and for the same reason.
   *
   * Overview leads: the tab was opened onto this chart, so landing on the list
   * of every other one would be the map arriving before the territory.
   * `library.analyses` is last for the same reason it is present at all — it is
   * how you get to a different chart, which is a thing you do after this one,
   * and a screen whose whole subject is one chart should not spend half its
   * states not showing one.
   */
  analysis: {
    workspace: ["overview.analysis", "project.variables", "library.analyses"]
  },

  /**
   * A thread's own rail, because a research tab *is* a thread.
   *
   * Overview leads: the tab was opened onto this line of enquiry, so landing on
   * the list of every other one would be the map arriving before the territory.
   * `library.threads` is last for the same reason it is present at all — it is
   * how you get to a different thread, which is a thing you do after this one.
   */
  research: {
    workspace: [
      "overview.research",
      "research.history",
      "research.inquiry",
      "research.findings",
      "research.sources",
      "research.trace",
      "research.context",
      "library.threads"
    ]
  },

  /**
   * The one screen that keeps a library-and-editor pair, because the library has
   * a folder structure and holds templates from outside this project — it is a
   * place rather than a list.
   */
  templates: {
    library: ["overview.templates-library", "library.recent-templates", "library.resources"],
    editor: [
      "overview.templates-authoring",
      "library.template",
      "library.authoring-variables",
      "library.authoring-insert",
      "library.authoring-design"
    ]
  },

  /**
   * Four centres, one rail each, and Overview on all four: the Agents screen
   * changes under you while you read it, so the figures that say what is running
   * have to be reachable from wherever you are.
   */
  agents: {
    library: ["overview.agents", "agents.personas", "agents.tasks", "agents.automations"],
    persona: [
      "overview.agents",
      "agents.personas",
      "agents.behaviour",
      "agents.work",
      "agents.tools",
      "agents.context-persona"
    ],
    task: ["overview.agents", "agents.tasks", "agents.work", "agents.tools", "agents.health"],
    automation: [
      "overview.agents",
      "agents.automations",
      "agents.when",
      "agents.do-this",
      "agents.health"
    ]
  },

  "document-editor": {
    workspace: [
      "overview.document",
      "resource.navigator",
      "resource.find-document",
      "resource.insert-document",
      "resource.styles-document",
      "resource.page",
      "project.variables",
      "resource.comments-document",
      "resource.context-document"
    ]
  },

  "new-tab": {
    workspace: [
      "library.create",
      "library.recent-newtab",
      "library.templates-newtab",
      "library.bring-in"
    ]
  },

  // The specification carries a second rail here, for editing a layout —
  // `resource.layout-layouts`, `resource.layout-objects`, `resource.layout-theme`,
  // `project.variables`. It has no row because a layout is not a subscreen: the
  // deck has one workspace file, and `layoutId` is what puts it in that state.
  "slide-deck-editor": {
    workspace: [
      "resource.slides",
      "overview.deck",
      "resource.layers",
      "resource.find-deck",
      "resource.layouts",
      "resource.insert-deck",
      "resource.theme",
      "resource.notes",
      "project.variables",
      "resource.comments-deck",
      "resource.context-deck"
    ]
  },

  "spreadsheet-editor": {
    workspace: [
      "overview.spreadsheet",
      "project.variables",
      "resource.named-ranges",
      "resource.find-sheet",
      "resource.dependencies",
      "resource.objects",
      "resource.insert-sheet",
      "resource.styles-sheet",
      "resource.print",
      "resource.comments-sheet",
      "resource.context-sheet"
    ]
  }
} as const;

const NONE: readonly ContextId[] = Object.freeze([]);

/** What the rail offers, in order. Empty for a subscreen with no rail of its own. */
export const railFor = (screen: Screen, subscreen: Subscreen): readonly ContextId[] =>
  RAILS[screen][subscreen] ?? NONE;

/**
 * The view the rail opens on: its first entry.
 *
 * `undefined` only where the rail is empty, which is a subscreen the
 * specification gave no context panel.
 */
export const defaultContext = (screen: Screen, subscreen: Subscreen): ContextId | undefined =>
  railFor(screen, subscreen)[0];

/**
 * The centre a screen opens on.
 *
 * **Named rather than derived, because neither thing it could be derived from is
 * right.** The generated `SUBSCREENS` is sorted, and the alphabet puts Templates
 * on `editor` and Agents on `automation` — screens opening on one thing being
 * edited rather than on the things they have. The order of the tables in this
 * file is the specification's order, which is a different arbitrary answer.
 *
 * The rule is the one the screen deck settled: **a permanent tab opens on its
 * library.** Nothing is selected yet when a project loads, so the honest centre
 * is the one that lists what there is and lets you open one — which object you
 * are then on is view state.
 */
export const DEFAULT_SUBSCREEN: Record<Screen, Subscreen> = {
  agents: "library",
  templates: "library",

  // One centre each; the generated name for it is `workspace`. Research and
  // Analysis are here rather than above because their libraries are rail entries
  // — the centre is the thing itself, so there is no library centre to default to.
  analysis: "workspace",
  research: "workspace",
  "document-editor": "workspace",
  "new-tab": "workspace",
  "project-overview": "workspace",
  "slide-deck-editor": "workspace",
  "spreadsheet-editor": "workspace"
};

export const defaultSubscreen = (screen: Screen): Subscreen => DEFAULT_SUBSCREEN[screen];

/** Whether this rail holds this view — the test a caller selecting a context owes. */
export const offersContext = (
  screen: Screen,
  subscreen: Subscreen,
  id: ContextId
): boolean => railFor(screen, subscreen).includes(id);
