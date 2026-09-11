import type { DeltaGroup } from "$development-views/project-overview-delivery/types";

export const DELTA_GROUPS: readonly DeltaGroup[] = [
  {
    id: "product",
    label: "Production views",
    summary: "The real context and inspector surfaces, plus the procedures that own their reads, effects, and command state.",
    additions: 1_203,
    deletions: 3,
    files: [
      { status: "New", path: "app/src/lib/app-views/categories/context-editor/content/unavailable.svelte" },
      { status: "Modified", path: "app/src/lib/app-views/categories/project-overview/content/overview.svelte" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/context/history.svelte" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/context/overview.svelte" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/inspector/activity.svelte" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/inspector/comment.svelte" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/inspector/resource.svelte" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/activity-label.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/comment-thread-command.svelte.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/effects/follows-history-filter.svelte.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/effects/ticks-the-clock.svelte.ts" },
      { status: "Modified", path: "app/src/lib/app-views/categories/project-overview/procedures/mentions.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/read-activity.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/read-comment.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/read-overview.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/read-resource.ts" },
      { status: "New", path: "app/src/lib/app-views/categories/project-overview/procedures/resource-summary-command.svelte.ts" },
      { status: "Modified", path: "app/src/lib/app-views/categories/project-overview/procedures/rows.ts" },
      { status: "Modified", path: "app/src/lib/app-views/categories/project-overview/project-overview.md" },
      { status: "New", path: "app/src/lib/app-views/general/person/person.svelte" },
      { status: "New", path: "app/src/lib/app-views/general/person/procedures/read-person.ts" }
    ]
  },
  {
    id: "capability",
    label: "Project capability and contracts",
    summary: "Seven public entries, their validation and projection helpers, public result types, and executable ownership and atomicity evidence.",
    additions: 1_697,
    deletions: 0,
    files: [
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-activity/read-project-activity.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-activity/validate-read-project-activity.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-comment/read-project-comment.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-comment/validate-read-project-comment.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-history/read-project-history.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-history/validate-read-project-history.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-overview/read-project-overview.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-person/read-project-person.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-person/validate-read-project-person.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-resource/read-project-resource.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/read-project-resource/validate-read-project-resource.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/shared/projection.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/shared/resources.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/shared/store.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/update-project-resource-summary/update-project-resource-summary.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/api/update-project-resource-summary/validate-update-project-resource-summary.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/index.remote.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/project.md" },
      { status: "New", path: "app/src/lib/capabilities/project/test/non-functional/ownership.test.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/test/non-functional/update-project-resource-summary-atomicity.test.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/test/unit/project.test.ts" },
      { status: "New", path: "app/src/lib/capabilities/project/types/project.ts" }
    ]
  },
  {
    id: "vocabulary",
    label: "Shared panel vocabulary",
    summary: "Opt-in capabilities added to existing primitives so production and reference panels share one visual language.",
    additions: 200,
    deletions: 49,
    files: [
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel-editable-text.svelte" },
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel-field.svelte" },
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel-fields.svelte" },
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel-link.svelte" },
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel-quote.svelte" },
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel-timeline.svelte" },
      { status: "Modified", path: "app/src/lib/components/authored/panel/panel.svelte" }
    ]
  },
  {
    id: "reference",
    label: "Interactive panel reference",
    summary: "Six target-state mocks, the code-derived data catalog, a responsive workbench, and its discoverable demo route.",
    additions: 1_783,
    deletions: 0,
    files: [
      { status: "Modified", path: "app/src/lib/development-views/demo-shell/demo-shell.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/components/activity-inspector-mock.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/components/comment-inspector-mock.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/components/history-context-mock.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/components/overview-context-mock.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/components/person-inspector-mock.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/components/resource-inspector-mock.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/procedures/catalog.ts" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/project-overview-panels.svelte" },
      { status: "New", path: "app/src/lib/development-views/project-overview-panels/types.ts" },
      { status: "New", path: "app/src/routes/demo/project-overview-panels/+page.svelte" }
    ]
  },
  {
    id: "representation",
    label: "Representation, fixtures, and workspace registry",
    summary: "Summary fields and fixtures, current view keys, a real unavailable state, generated unions, and one retired baseline exception.",
    additions: 34,
    deletions: 21,
    files: [
      { status: "Modified", path: "app/configuration/architecture-baseline.json" },
      { status: "Modified", path: "app/seed/commentThreads.json" },
      { status: "Modified", path: "app/seed/comments.json" },
      { status: "Modified", path: "app/seed/documents.json" },
      { status: "Modified", path: "app/seed/findings.json" },
      { status: "Modified", path: "app/seed/researchThreads.json" },
      { status: "Modified", path: "app/seed/presentations.json" },
      { status: "Modified", path: "app/seed/spreadsheets.json" },
      { status: "Modified", path: "app/src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts" },
      { status: "Modified", path: "app/src/lib/representation/data/behavior/workspace/categories.ts" },
      { status: "Modified", path: "app/src/lib/representation/data/behavior/workspace/opening.ts" },
      { status: "Modified", path: "app/src/lib/representation/data/behavior/workspace/views.ts" },
      { status: "Modified", path: "app/src/lib/representation/data/types/workspace/categories.ts" },
      { status: "Modified", path: "app/src/lib/representation/data/types/workspace/views.ts" },
      { status: "Modified", path: "app/src/lib/representation/store/tables.ts" }
    ]
  },
  {
    id: "browser",
    label: "Chromium contracts",
    summary: "End-to-end evidence for every panel and a robust document interaction sequence at the integration boundary.",
    additions: 239,
    deletions: 5,
    files: [
      { status: "Modified", path: "app/test/browser/document-editor.spec.ts" },
      { status: "New", path: "app/test/browser/project-overview-panels.spec.ts" }
    ]
  }
];

export const deltaFileCount = (): number =>
  DELTA_GROUPS.reduce((total, group) => total + group.files.length, 0);

export const deltaAdditionCount = (): number =>
  DELTA_GROUPS.reduce((total, group) => total + group.additions, 0);

export const deltaDeletionCount = (): number =>
  DELTA_GROUPS.reduce((total, group) => total + group.deletions, 0);
