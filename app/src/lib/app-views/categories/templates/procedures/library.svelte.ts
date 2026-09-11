export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type { TemplateAnswers } from "$capabilities/templates/index.remote";
export type {
  LibraryTemplate,
  LibraryTemplateDetail,
  TemplateSlot,
  TemplateLibrarySummary,
  TemplateScope,
  TemplateTarget
} from "$app-views/categories/templates/procedures/library-types";
export { EDITOR_CATEGORY } from "$app-views/categories/templates/procedures/library-types";

export {
  answerRowsOf,
  missingIn,
  type AnswerRow
} from "$representation/data/behavior/templates/answers";
export {
  PROJECT_KINDS as KINDS,
  builderView,
  draftOf,
  isWholeProject,
  narrowed,
  needsRow,
  ruleWords as ruleOf,
  termFor,
  withTerm,
  withWholeProject,
  withoutTerm,
  type OfferSource,
  type ScopeDraft,
  type ScopeNames,
  type ScopeSide
} from "$representation/data/behavior/core/scope-draft";

export { relativeTime } from "$app-views/categories/templates/procedures/library-time";
export {
  detailIn,
  emptyTemplateInspectorTitle,
  recentTemplatesIn,
  selectedTemplateIdIn,
  templateDetail,
  templateLibrary,
  templatesIn,
  unavailableTemplateIn
} from "$app-views/categories/templates/procedures/library-read.svelte";
export { nextTemplateName, templateLibrarySummaryIn } from "$app-views/categories/templates/procedures/library-summary";
export {
  answersFrom,
  offeringOf,
  projectResources,
  resourceSets,
  resourcesIn,
  scopeNamesOf,
  setsIn,
  wordsFrom
} from "$app-views/categories/templates/procedures/library-scope.svelte";

export { inspectTemplate } from "$app-views/categories/templates/procedures/inspect-template";
export { createTemplate } from "$app-views/categories/templates/procedures/create-template";
export { updateTemplateName } from "$app-views/categories/templates/procedures/update-template-name";
export { updateTemplateDescription } from "$app-views/categories/templates/procedures/update-template-description";
export { updateTemplateSlotDescription } from "$app-views/categories/templates/procedures/update-template-slot-description";
export { updateTemplateTags } from "$app-views/categories/templates/procedures/update-template-tags";
export { updateTemplateSlotDefault } from "$app-views/categories/templates/procedures/update-template-slot-default";
export { duplicateTemplate } from "$app-views/categories/templates/procedures/duplicate-template";
export { removeTemplate } from "$app-views/categories/templates/procedures/remove-template";
export { instantiateTemplate } from "$app-views/categories/templates/procedures/instantiate-template";
export { editTemplate } from "$app-views/categories/templates/procedures/edit-template";
