import type { ContextView } from "$representation/data/types/workspace/views";
import type { Category, ContentView } from "$representation/data/types/workspace/categories";

export const RAILS: Record<Category, readonly ContextView[]> = {
  "project-overview": [
    "project-overview.overview",
    "project-overview.history",
    "project-overview.variables",
    "project-overview.contexts"
  ],

  analysis: ["analysis.overview", "analysis.variables", "analysis.analyses"],

  research: [
    "research.overview",
    "research.history",
    "research.inquiry",
    "research.findings",
    "research.sources",
    "research.trace",
    "research.context",
    "research.threads"
  ],

  templates: [
    "templates.overview-library",
    "templates.recent",
    "templates.resources",
    "templates.overview-authoring",
    "templates.template",
    "templates.authoring-variables",
    "templates.authoring-insert",
    "templates.authoring-design"
  ],

  agents: [
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
  ],

  "document-editor": [
    "document-editor.overview",
    "document-editor.navigator",
    "document-editor.find",
    "document-editor.insert",
    "document-editor.styles",
    "document-editor.page",
    "document-editor.variables",
    "document-editor.comments",
    "document-editor.context"
  ],

  "new-tab": ["new-tab.create", "new-tab.recent", "new-tab.templates", "new-tab.bring-in"],

  "slide-deck-editor": [
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
  ],

  "spreadsheet-editor": [
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
  ],

  "context-editor": []
} as const;

export const railFor = (category: Category): readonly ContextView[] => RAILS[category];

export const defaultContext = (category: Category): ContextView | undefined => railFor(category)[0];

export const DEFAULT_CONTENT: Partial<Record<Category, ContentView>> = {
  agents: "agents.library",
  templates: "templates.library",
  analysis: "analysis.chart",
  research: "research.thread",
  "document-editor": "document-editor.document",
  "new-tab": "new-tab.launcher",
  "project-overview": "project-overview.overview",
  "slide-deck-editor": "slide-deck-editor.deck",
  "spreadsheet-editor": "spreadsheet-editor.sheet"
};

export const defaultContent = (category: Category): ContentView | undefined =>
  DEFAULT_CONTENT[category];

export const offersContext = (category: Category, id: ContextView): boolean =>
  railFor(category).includes(id);
