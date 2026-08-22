import type { ContextId, Screen, Subscreen } from "$model/client/view-state/methods/shared/keys";

/**
 * Which context views a screen's rail offers, in order, and which one it opens on.
 *
 * **Transcribed from `docs/screen-panel-views/screens/<screen>/overview.md`, not
 * derived.** Each screen's "## Context panel" table is this map's row, in the
 * table's order, and the first entry is that subscreen's default. Nothing here is
 * inferred from the file tree: a view can exist without a rail offering it, so a
 * rail that disagrees with the specification is changed in the specification
 * first and copied down here after.
 *
 * Overview leads every rail but a deck's, where the list of slides is the
 * orientation instead.
 */
export const RAILS: Record<Screen, Partial<Record<Subscreen, readonly ContextId[]>>> = {
  analysis: {
    "one-analysis": [
      "overview.analysis",
      "analysis.variables",
      "analysis.chart",
      "analysis.fields",
      "analysis.formula"
    ],
    "all-analyses": ["library.analyses", "project.variables"]
  },

  // One table in the specification, and it says the rail is the same in both.
  automations: {
    library: [
      "overview.automations",
      "agents.automations",
      "agents.when",
      "agents.do-this",
      "agents.health"
    ],
    rule: [
      "overview.automations",
      "agents.automations",
      "agents.when",
      "agents.do-this",
      "agents.health"
    ]
  },

  context: {
    "one-context": [
      "overview.context",
      "scope.contexts",
      "scope.add",
      "scope.contents",
      "scope.knowledge",
      "scope.used-by"
    ],
    "all-contexts": ["library.contexts", "library.resources"]
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

  personas: {
    library: [
      "overview.personas",
      "agents.personas",
      "agents.work",
      "agents.behaviour",
      "agents.context-persona",
      "agents.tools"
    ],
    profile: [
      "overview.personas",
      "agents.personas",
      "agents.work",
      "agents.behaviour",
      "agents.context-persona",
      "agents.tools"
    ]
  },

  "project-overview": {
    workspace: [
      "overview.project",
      "project.resources",
      "project.mentions",
      "project.people",
      "project.activity",
      "project.tasks",
      "project.health",
      "project.variables",
      "project.contexts",
      "project.templates"
    ]
  },

  research: {
    "one-question": [
      "overview.research",
      "research.history",
      "research.inquiry",
      "research.findings",
      "research.sources",
      "research.trace",
      "research.context"
    ],
    "all-threads": ["library.threads", "library.findings", "library.inquiry"]
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
  },

  templates: {
    library: [
      "overview.templates-library",
      "library.templates",
      "library.template-kinds",
      "library.recent-templates"
    ],
    editor: [
      "overview.templates-authoring",
      "library.authoring-variables",
      "library.authoring-body",
      "library.authoring-insert",
      "library.authoring-design"
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
 * on `editor` — a screen opening on a template being authored rather than on the
 * templates it has. The order of the tables in this file is the specification's
 * order, and that puts Research on `one-question`, because its overview describes
 * that subscreen first.
 *
 * The rule is the one the screen deck settled: **a permanent tab opens on its
 * library.** Nothing is selected yet when a project loads, so the honest centre
 * is the one that lists what there is and lets you open one — which object you
 * are then on is view state.
 */
export const DEFAULT_SUBSCREEN: Record<Screen, Subscreen> = {
  analysis: "all-analyses",
  automations: "library",
  context: "all-contexts",
  personas: "library",
  research: "all-threads",
  templates: "library",

  // One centre each; the generated name for it is `workspace`.
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
