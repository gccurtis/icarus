import type { Category, ContentView } from "$representation/data/types/workspace/categories";
import type { ContextView } from "$representation/data/types/workspace/views";
import type { TabView } from "$representation/data/types/workspace/tab";

/**
 * What a tab of each category is, before anything has happened to it: the centre
 * it opens on, the context view it lands on, and the rail it offers.
 *
 * **`context` is stated, not the rail's head.** A rail is an ordered menu and
 * the landing is a separate decision; deriving one from the other means
 * reordering the menu silently moves where every tab of that category opens.
 * They coincide today for every category, and coinciding is not the same as
 * being the same fact.
 *
 * Vocabulary rather than client policy, because two parties read it: a client
 * mints a tab from it, and the server builds the workspace a first change set is
 * stated against. A change set carries ops and nothing else, so the state behind
 * them has to be constructible from here alone.
 */
export type Opening = {
  /** Absent where a category has no centre to default to, which `mintView` refuses. */
  readonly content?: ContentView;
  readonly context: ContextView | null;
  readonly rail: readonly ContextView[];
};

export const OPENING: Record<Category, Opening> = {
  "project-overview": {
    content: "project-overview.overview",
    context: "project-overview.overview",
    rail: [
      "project-overview.overview",
      "project-overview.history",
      "project-overview.variables",
      "project-overview.contexts"
    ]
  },

  analysis: {
    content: "analysis.chart",
    context: "analysis.overview",
    rail: ["analysis.overview", "analysis.variables", "analysis.analyses"]
  },

  research: {
    content: "research.thread",
    context: "research.overview",
    rail: [
      "research.overview",
      "research.history",
      "research.inquiry",
      "research.findings",
      "research.sources",
      "research.trace",
      "research.context",
      "research.threads"
    ]
  },

  templates: {
    content: "templates.library",
    context: "templates.overview-library",
    rail: ["templates.overview-library"]
  },

  agents: {
    content: "agents.library",
    context: "agents.overview",
    rail: [
      "agents.overview",
      "agents.personas",
      "agents.tasks",
      "agents.automations",
      "agents.behaviour",
      "agents.context-persona",
      "agents.work",
      "agents.tools",
      "agents.when",
      "agents.do-this",
      "agents.health"
    ]
  },

  "document-editor": {
    content: "document-editor.document",
    context: "document-editor.overview",
    rail: [
      "document-editor.overview",
      "document-editor.navigator",
      "document-editor.find",
      "document-editor.insert",
      "document-editor.styles",
      "document-editor.layout",
      "document-editor.variables",
      "document-editor.comments",
      "document-editor.context"
    ]
  },

  "new-tab": {
    content: "new-tab.launcher",
    context: "new-tab.create",
    rail: ["new-tab.create", "new-tab.recent", "new-tab.templates", "new-tab.bring-in"]
  },

  "slide-deck-editor": {
    content: "slide-deck-editor.deck",
    context: "slide-deck-editor.slides",
    rail: [
      "slide-deck-editor.slides",
      "slide-deck-editor.overview",
      "slide-deck-editor.stage",
      "slide-deck-editor.layers",
      "slide-deck-editor.find",
      "slide-deck-editor.layouts",
      "slide-deck-editor.insert",
      "slide-deck-editor.theme",
      "slide-deck-editor.notes",
      "slide-deck-editor.variables",
      "slide-deck-editor.comments",
      "slide-deck-editor.context"
    ]
  },

  "spreadsheet-editor": {
    content: "spreadsheet-editor.sheet",
    context: "spreadsheet-editor.overview",
    rail: [
      "spreadsheet-editor.overview",
      "spreadsheet-editor.variables",
      "spreadsheet-editor.named-ranges",
      "spreadsheet-editor.find",
      "spreadsheet-editor.dependencies",
      "spreadsheet-editor.objects",
      "spreadsheet-editor.insert",
      "spreadsheet-editor.styles",
      "spreadsheet-editor.print",
      "spreadsheet-editor.comments",
      "spreadsheet-editor.context"
    ]
  },

  "context-editor": { context: null, rail: [] }
};

export const railFor = (category: Category): readonly ContextView[] => OPENING[category].rail;

export const defaultContent = (category: Category): ContentView | undefined =>
  OPENING[category].content;

export const defaultContext = (category: Category): ContextView | null =>
  OPENING[category].context;

export const offersContext = (category: Category, id: ContextView): boolean =>
  railFor(category).includes(id);

/**
 * Both flanks open at the narrowest a drag may leave them, so a tab starts with
 * as much of the width under the work as it can have and every pixel either
 * panel takes after that was asked for.
 *
 * The inspector's number is its whole width; the context panel's is its content
 * alone, because the rail beside it is structural and the panel adds it back.
 */
export const STARTING_FRAME = Object.freeze({
  contextWidth: 180,
  contextCollapsed: false,
  inspectorWidth: 224,
  inspectorCollapsed: false
});

/** A tab opens with its zoom undecided, which its centre reads as it sees fit. */
export const STARTING_ZOOM: number | null = null;

export type Overrides = {
  readonly content?: ContentView;
  readonly focus?: string;
};

/**
 * The one place a `TabView` is built. A caller that knows better than the
 * category says so through `overrides`; everything else comes from `OPENING`.
 */
export const openingView = (category: Category, overrides: Overrides = {}): TabView => {
  const content = overrides.content ?? defaultContent(category);
  if (content === undefined) throw new Error(`'${category}' has no content view to open on`);

  return {
    content,
    focus: overrides.focus ?? null,
    contextId: defaultContext(category),
    inspected: "empty",
    selection: null,
    frame: { ...STARTING_FRAME },
    zoom: STARTING_ZOOM
  };
};
