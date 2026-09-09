import type { Category, ContentView } from "$representation/data/types/workspace/categories";
import type { ContextView } from "$representation/data/types/workspace/views";
import type { TabView } from "$representation/data/types/workspace/tab";

export type Opening = {
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
      "project-overview.contexts"
    ]
  },

  analysis: {
    content: "analysis.chart",
    context: "analysis.overview",
    rail: ["analysis.overview", "analysis.variables", "analysis.analyses"]
  },

  external: {
    content: "external.library",
    context: "external.overview",
    rail: ["external.overview", "external.activity", "external.policy"]
  },

  research: {
    content: "research.thread",
    context: "research.threads",
    rail: ["research.threads", "research.turns"]
  },

  templates: {
    content: "templates.library",
    context: "templates.overview-library",
    rail: ["templates.overview-library"]
  },

  agents: {
    content: "agents.library",
    context: "agents.personas",
    rail: [
      "agents.personas",
      "agents.tasks",
      "agents.automations"
    ]
  },

  "document-editor": {
    content: "document-editor.document",
    context: "document-editor.layout",
    rail: [
      "document-editor.layout",
      "document-editor.find",
      "document-editor.styles",
      "document-editor.comments",
      "document-editor.variables",
      "document-editor.templates",
      "document-editor.prompts",
      "document-editor.navigator"
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
      "slide-deck-editor.insert",
      "slide-deck-editor.layers",
      "slide-deck-editor.theme",
      "slide-deck-editor.find",
      "slide-deck-editor.comments",
      "slide-deck-editor.templates",
      "slide-deck-editor.variables",
      "slide-deck-editor.prompts"
    ]
  },

  "spreadsheet-editor": {
    content: "spreadsheet-editor.sheet",
    context: "spreadsheet-editor.grid",
    rail: [
      "spreadsheet-editor.grid",
      "spreadsheet-editor.find",
      "spreadsheet-editor.formulas",
      "spreadsheet-editor.styles",
      "spreadsheet-editor.charts",
      "spreadsheet-editor.comments",
      "spreadsheet-editor.variables",
      "spreadsheet-editor.templates",
      "spreadsheet-editor.prompts"
    ]
  },

  "context-editor": {
    content: "context-editor.unavailable",
    context: null,
    rail: []
  }
};

export const railFor = (category: Category): readonly ContextView[] => OPENING[category].rail;

export const defaultContent = (category: Category): ContentView | undefined =>
  OPENING[category].content;

export const defaultContext = (category: Category): ContextView | null =>
  OPENING[category].context;

export const offersContext = (category: Category, id: ContextView): boolean =>
  railFor(category).includes(id);

export const STARTING_FRAME = Object.freeze({
  contextWidth: 180,
  contextCollapsed: false,
  inspectorWidth: 224,
  inspectorCollapsed: false
});

export const STARTING_ZOOM: number | null = null;

export type Overrides = {
  readonly content?: ContentView;
  readonly context?: ContextView;
  readonly focus?: string;
};

export const openingView = (category: Category, overrides: Overrides = {}): TabView => {
  const content = overrides.content ?? defaultContent(category);
  if (content === undefined) throw new Error(`'${category}' has no content view to open on`);

  return {
    content,
    focus: overrides.focus ?? null,
    contextId:
      overrides.context !== undefined && offersContext(category, overrides.context)
        ? overrides.context
        : defaultContext(category),
    inspected: "empty",
    selection: null,
    frame: { ...STARTING_FRAME },
    zoom: STARTING_ZOOM
  };
};
