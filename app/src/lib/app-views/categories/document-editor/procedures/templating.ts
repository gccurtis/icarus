export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type {
  ResourceTemplateStage,
  TemplateAnswers,
  TemplateDetail,
  TemplateLibraryItem
} from "$capabilities/templates/index.remote";
export type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
export type { TemplateSlot } from "$representation/data/types/templates/template";

export {
  answerRowsOf,
  missingIn,
  type AnswerRow
} from "$representation/data/behavior/templates/answers";

export {
  defaultScopeOf,
  slotMarkOver,
  slotNameOver,
  slotNamesIn,
  nextSlotName,
  offeredSlotName,
  promptWordsIn
} from "$representation/data/behavior/templates/prompt-slots";

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

export {
  answersFrom,
  offeringOf,
  projectResources,
  resourceSets,
  resourcesIn,
  scopeNamesOf,
  setsIn,
  wordsFrom
} from "$app-views/categories/document-editor/procedures/template-scope";
export {
  detailIn,
  documentTemplatesIn,
  resourceTemplate,
  stageIn,
  templateDetail,
  templateLibrary
} from "$app-views/categories/document-editor/procedures/template-resources";
export { currentRowId, insertionOf, type Insertion } from "$app-views/categories/document-editor/procedures/template-insertion";
export {
  markedSlotAt,
  markSlotOps,
  mergedSlots,
  readableScope,
  selectedRange,
  selectedWords,
  withSlotField,
  type ChosenSlot
} from "$app-views/categories/document-editor/procedures/template-slots";
export { saveAsTemplate } from "$app-views/categories/document-editor/procedures/save-template";
export { openStage } from "$app-views/categories/document-editor/procedures/open-template-stage";
export { commitStage } from "$app-views/categories/document-editor/procedures/commit-template-stage";
export { discardStage } from "$app-views/categories/document-editor/procedures/discard-template-stage";
export { updateSlots } from "$app-views/categories/document-editor/procedures/update-template-slots";
