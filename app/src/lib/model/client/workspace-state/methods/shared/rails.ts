import type { ContextView } from "$representation/data/types/workspace/views";
import type { Category, Subscreen } from "$representation/data/types/workspace/categories";

export const RAILS: Record<Category, Partial<Record<Subscreen, readonly ContextView[]>>> = {
  "project-overview": {
    overview: [
      "project-overview.overview",
      "project-overview.history",
      "project-overview.variables",
      "project-overview.contexts"
    ]
  },

  analysis: {
    chart: ["analysis.overview", "analysis.variables", "analysis.analyses"]
  },

  research: {
    thread: [
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
    library: ["templates.overview-library", "templates.recent", "templates.resources"],
    editor: [
      "templates.overview-authoring",
      "templates.template",
      "templates.authoring-variables",
      "templates.authoring-insert",
      "templates.authoring-design"
    ]
  },

  agents: {
    library: ["agents.overview", "agents.personas", "agents.tasks", "agents.automations"],
    persona: [
      "agents.overview",
      "agents.personas",
      "agents.behaviour",
      "agents.work",
      "agents.tools",
      "agents.context-persona"
    ],
    task: ["agents.overview", "agents.tasks", "agents.work", "agents.tools", "agents.health"],
    automation: [
      "agents.overview",
      "agents.automations",
      "agents.when",
      "agents.do-this",
      "agents.health"
    ]
  },

  "document-editor": {
    document: [
      "document-editor.overview",
      "document-editor.navigator",
      "document-editor.find",
      "document-editor.insert",
      "document-editor.styles",
      "document-editor.page",
      "document-editor.variables",
      "document-editor.comments",
      "document-editor.context"
    ]
  },

  "new-tab": {
    launcher: ["new-tab.create", "new-tab.recent", "new-tab.templates", "new-tab.bring-in"]
  },

  "slide-deck-editor": {
    deck: [
      "slide-deck-editor.slides",
      "slide-deck-editor.overview",
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
    sheet: [
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

  "context-editor": {}
} as const;

const NONE: readonly ContextView[] = Object.freeze([]);

export const railFor = (category: Category, subscreen: Subscreen): readonly ContextView[] =>
  RAILS[category][subscreen] ?? NONE;

export const defaultContext = (category: Category, subscreen: Subscreen): ContextView | undefined =>
  railFor(category, subscreen)[0];

export const DEFAULT_SUBSCREEN: Partial<Record<Category, Subscreen>> = {
  agents: "library",
  templates: "library",
  analysis: "chart",
  research: "thread",
  "document-editor": "document",
  "new-tab": "launcher",
  "project-overview": "overview",
  "slide-deck-editor": "deck",
  "spreadsheet-editor": "sheet"
};

export const defaultSubscreen = (category: Category): Subscreen | undefined =>
  DEFAULT_SUBSCREEN[category];

export const offersContext = (category: Category, subscreen: Subscreen, id: ContextView): boolean =>
  railFor(category, subscreen).includes(id);
