/**
 * Every key the panel trees define. Generated — do not edit.
 *
 *     pnpm view-state-keys
 *
 * A key is a path: `context/project/variables.svelte` is `"project.variables"`,
 * and `workspaces/research/workspace-one-question.svelte` is the `research`
 * screen's `"one-question"`.
 *
 * `pnpm view-state-keys -- --check` fails when this file and the trees
 * disagree, which is what stops a key naming something that is not there.
 */

/** Every context-panel view: one id per file under `context/`. */
export const CONTEXT_IDS = [
  "agents.automations",
  "agents.behaviour",
  "agents.context-persona",
  "agents.do-this",
  "agents.health",
  "agents.personas",
  "agents.tools",
  "agents.when",
  "agents.work",
  "analysis.chart",
  "analysis.fields",
  "analysis.formula",
  "analysis.variables",
  "library.analyses",
  "library.authoring-body",
  "library.authoring-design",
  "library.authoring-insert",
  "library.authoring-variables",
  "library.bring-in",
  "library.contexts",
  "library.create",
  "library.findings",
  "library.inquiry",
  "library.recent-newtab",
  "library.recent-templates",
  "library.resources",
  "library.template-kinds",
  "library.templates",
  "library.templates-newtab",
  "library.threads",
  "overview.analysis",
  "overview.automations",
  "overview.context",
  "overview.deck",
  "overview.document",
  "overview.personas",
  "overview.project",
  "overview.research",
  "overview.spreadsheet",
  "overview.templates-authoring",
  "overview.templates-library",
  "project.activity",
  "project.contexts",
  "project.health",
  "project.mentions",
  "project.people",
  "project.resources",
  "project.tasks",
  "project.templates",
  "project.variables",
  "project.variables-create",
  "research.context",
  "research.findings",
  "research.history",
  "research.inquiry",
  "research.sources",
  "research.trace",
  "resource.comments-deck",
  "resource.comments-document",
  "resource.comments-sheet",
  "resource.context-deck",
  "resource.context-document",
  "resource.context-sheet",
  "resource.dependencies",
  "resource.find-deck",
  "resource.find-document",
  "resource.find-sheet",
  "resource.insert-deck",
  "resource.insert-document",
  "resource.insert-sheet",
  "resource.layers",
  "resource.layout-layouts",
  "resource.layout-objects",
  "resource.layout-theme",
  "resource.layouts",
  "resource.named-ranges",
  "resource.navigator",
  "resource.notes",
  "resource.objects",
  "resource.page",
  "resource.print",
  "resource.slides",
  "resource.styles-document",
  "resource.styles-sheet",
  "resource.theme",
  "scope.add",
  "scope.contents",
  "scope.contexts",
  "scope.knowledge",
  "scope.used-by"
] as const;

export type ContextId = (typeof CONTEXT_IDS)[number];

/**
 * Every inspector lens: one key per file under `inspector/`.
 *
 * `"empty"` is deliberately absent. Nothing being inspected is a state of the
 * model rather than a file in the tree, so it belongs to the hand-written type
 * that unions the two.
 */
export const INSPECTION_KEYS = [
  "agents.agent-action",
  "agents.automation",
  "agents.behaviour-section",
  "agents.last-fired",
  "agents.model",
  "agents.persona",
  "agents.refresh-action",
  "agents.schedule-trigger",
  "agents.tool",
  "agents.what-it-can-look-up",
  "analysis.analysis",
  "analysis.chart",
  "analysis.filter",
  "analysis.limit",
  "analysis.mark",
  "analysis.placement",
  "analysis.relationship",
  "analysis.sort",
  "analysis.variable",
  "collaboration.comment",
  "collaboration.mention",
  "collaboration.people",
  "collaboration.person",
  "copilot.conversation",
  "copilot.home",
  "copilot.task",
  "copilot.what-it-can-see",
  "library.body-entity",
  "library.connect",
  "library.new-deck",
  "library.new-document",
  "library.new-spreadsheet",
  "library.recent-item",
  "library.start-from-template",
  "library.template",
  "library.template-variable",
  "library.upload",
  "library.use-template",
  "project.activity",
  "project.connector",
  "project.file",
  "project.project",
  "project.resource",
  "research.accepted-finding",
  "research.hypothesis",
  "research.proposed-finding",
  "research.question",
  "research.research-thread",
  "research.source",
  "research.thread",
  "research.tool-call",
  "resource.cell",
  "resource.cell-with-formula",
  "resource.chart",
  "resource.deck",
  "resource.document",
  "resource.element",
  "resource.error-cell",
  "resource.footer",
  "resource.formula",
  "resource.header",
  "resource.layout",
  "resource.link",
  "resource.locked-element",
  "resource.multi-selection",
  "resource.named-range",
  "resource.named-style-deck",
  "resource.named-style-document",
  "resource.named-style-sheet",
  "resource.placeholder",
  "resource.prompt-block",
  "resource.range",
  "resource.slide",
  "resource.speaker-notes",
  "resource.spill",
  "resource.spreadsheet",
  "resource.table",
  "resource.text-block-deck",
  "resource.text-block-document",
  "resource.text-selection",
  "resource.theme",
  "scope.context",
  "scope.generated-block",
  "scope.include-context",
  "scope.include-everything",
  "scope.lattice-node",
  "scope.resolved-resource",
  "scope.search-result",
  "scope.take-out-kind"
] as const;

export type InspectionKey = (typeof INSPECTION_KEYS)[number];

/** Every screen: one per directory under `workspaces/`. */
export const SCREENS = [
  "analysis",
  "automations",
  "context",
  "document-editor",
  "new-tab",
  "personas",
  "project-overview",
  "research",
  "slide-deck-editor",
  "spreadsheet-editor",
  "templates"
] as const;

export type Screen = (typeof SCREENS)[number];

/**
 * What each screen can show in its centre, with the prefix its files carry
 * stripped: `workspace.svelte` is `"workspace"` and
 * `workspace-one-question.svelte` is `"one-question"`.
 *
 * `as const satisfies` rather than a plain annotation, so the members stay
 * literal — `Subscreen` is read back off this table — while a screen missing
 * from it still fails to compile.
 */
export const SUBSCREENS = {
  "analysis": ["all-analyses", "one-analysis"],
  "automations": ["library", "rule"],
  "context": ["all-contexts", "one-context"],
  "document-editor": ["workspace"],
  "new-tab": ["workspace"],
  "personas": ["library", "profile"],
  "project-overview": ["workspace"],
  "research": ["all-threads", "one-question"],
  "slide-deck-editor": ["workspace"],
  "spreadsheet-editor": ["workspace"],
  "templates": ["editor", "library"]
} as const satisfies Record<Screen, readonly string[]>;

export type Subscreen = (typeof SUBSCREENS)[Screen][number];

export const isContextId = (value: string): value is ContextId =>
  (CONTEXT_IDS as readonly string[]).includes(value);

export const isInspectionKey = (value: string): value is InspectionKey =>
  (INSPECTION_KEYS as readonly string[]).includes(value);

export const isScreen = (value: string): value is Screen =>
  (SCREENS as readonly string[]).includes(value);
