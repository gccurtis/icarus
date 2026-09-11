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
  defaultScopeOf,
  slotMarkOver,
  slotNameOver,
  slotNamesIn,
  nextSlotName,
  offeredSlotName,
  promptSlotNameIn,
  promptWordsIn
} from "$representation/data/behavior/templates/prompt-slots";
export { liveSlotsOf } from "$representation/data/behavior/templates/slot-inventory";
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

export {
  answersFrom,
  offeringOf,
  projectResources,
  resourceSets,
  resourcesIn,
  scopeNamesOf,
  setsIn,
  wordsFrom
} from "$app-views/categories/presentation-editor/procedures/template-scope";
export {
  presentationTemplatesIn,
  detailIn,
  resourceTemplate,
  stageIn,
  templateDetail,
  templateLibrary
} from "$app-views/categories/presentation-editor/procedures/template-resources";
export { insertionOf, type Insertion } from "$app-views/categories/presentation-editor/procedures/template-insertion";
export {
  markedSlotAt,
  markSlotOps,
  mergedSlots,
  readableScope,
  selectedWords,
  slotSignal,
  withSlotField,
  type ChosenSlot
} from "$app-views/categories/presentation-editor/procedures/template-slots";
export { saveAsTemplate } from "$app-views/categories/presentation-editor/procedures/save-template";
export { openStage } from "$app-views/categories/presentation-editor/procedures/open-template-stage";
export { commitStage } from "$app-views/categories/presentation-editor/procedures/commit-template-stage";
export { discardStage } from "$app-views/categories/presentation-editor/procedures/discard-template-stage";
export { updateSlots } from "$app-views/categories/presentation-editor/procedures/update-template-slots";
