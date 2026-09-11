export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type {
  ResourceTemplateStage,
  TemplateAnswers,
  TemplateDetail,
  TemplateLibraryItem
} from "$capabilities/templates/index.remote";
export type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
export type { TemplateHole } from "$representation/data/types/templates/template";

export {
  defaultScopeOf,
  holeMarkOver,
  holeNameOver,
  holeNamesIn,
  nextHoleName,
  offeredHoleName,
  promptWordsIn
} from "$representation/data/behavior/templates/prompt-holes";
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
  markedHoleAt,
  markHoleOps,
  mergedHoles,
  readableScope,
  selectedWords,
  withHoleField,
  type ChosenHole
} from "$app-views/categories/presentation-editor/procedures/template-holes";
export { saveAsTemplate } from "$app-views/categories/presentation-editor/procedures/save-template";
export { openStage } from "$app-views/categories/presentation-editor/procedures/open-template-stage";
export { commitStage } from "$app-views/categories/presentation-editor/procedures/commit-template-stage";
export { discardStage } from "$app-views/categories/presentation-editor/procedures/discard-template-stage";
export { updateHoles } from "$app-views/categories/presentation-editor/procedures/update-template-holes";
