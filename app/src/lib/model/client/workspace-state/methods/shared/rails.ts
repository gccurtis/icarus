import type { ContextId } from "$representation/data/types/workspace/panels";
import type { Screen, Subscreen } from "$representation/data/types/workspace/screens";

export const RAILS: Record<Screen, Partial<Record<Subscreen, readonly ContextId[]>>> = {
  "project-overview": {
    workspace: ["overview.project", "project.history", "project.variables", "project.contexts"]
  },

  analysis: {
    workspace: ["overview.analysis", "project.variables", "library.analyses"]
  },

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

export const railFor = (screen: Screen, subscreen: Subscreen): readonly ContextId[] =>
  RAILS[screen][subscreen] ?? NONE;

export const defaultContext = (screen: Screen, subscreen: Subscreen): ContextId | undefined =>
  railFor(screen, subscreen)[0];

export const DEFAULT_SUBSCREEN: Record<Screen, Subscreen> = {
  agents: "library",
  templates: "library",
  analysis: "workspace",
  research: "workspace",
  "document-editor": "workspace",
  "new-tab": "workspace",
  "project-overview": "workspace",
  "slide-deck-editor": "workspace",
  "spreadsheet-editor": "workspace"
};

export const defaultSubscreen = (screen: Screen): Subscreen => DEFAULT_SUBSCREEN[screen];

export const offersContext = (screen: Screen, subscreen: Subscreen, id: ContextId): boolean =>
  railFor(screen, subscreen).includes(id);
