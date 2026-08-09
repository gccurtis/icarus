export { createSlidesCapability } from "./application/slidesService.js";
export type {
  SlideClock,
  SlideDependencies,
  SlidesCapability
} from "./application/slidesService.js";
export {
  createBlankDeckSnapshot,
  createDefaultDeckTheme,
  createDefaultSlideStyles,
  DEFAULT_SLIDE_CANVAS,
  INITIAL_BODY_SLOT_ID,
  INITIAL_LAYOUT_ID,
  INITIAL_MASTER_ID,
  INITIAL_SLIDE_ID,
  INITIAL_TITLE_SLOT_ID
} from "./application/createService.js";

export * from "./domain/model.js";
export * from "./domain/errors.js";
export {
  applyOperations,
  applyWithoutValidation,
  computeTouchedIds,
  resolveSlideStyle
} from "./domain/reducer.js";
export { invertOperations } from "./domain/inverses.js";
export { canRebase } from "./domain/rebase.js";
export {
  canonicalize,
  canonicalDigest,
  canonicalizeSnapshot,
  digestFormulaExpression
} from "./domain/canonical.js";
export { deckOutline } from "./domain/outline.js";
export { validateSnapshot, SLIDE_ELEMENT_KINDS } from "./domain/validation.js";
export {
  collectSlideIdentities,
  computeSlideIdentityTransitions
} from "./domain/identities.js";
export type {
  SlideIdentity,
  SlideIdentityKind,
  SlideIdentityLedgerEntry,
  SlideIdentityLedgerState,
  SlideIdentityReactivation,
  SlideIdentityTransitions
} from "./domain/identities.js";
export {
  allContainers,
  descendantsOf,
  paintOrder,
  promptSiteKey,
  promptSites,
  siblingsOf,
  unreachableElementIds
} from "./domain/elements.js";
export {
  resolveBackground,
  resolveColor,
  resolveElementFrame,
  resolveSlidePlan,
  slotBindings,
  unfilledSlots
} from "./domain/presentation.js";

export type { SlidesStore } from "./ports/slidesStore.js";
export type { SlideActivityPublisher } from "./ports/activityPublisher.js";
export type { SlideDerivedOutputs } from "./ports/derivedOutputs.js";
export { SQLiteSlidesStore } from "./persistence/sqliteSlidesStore.js";

export { decodeSlideCommand } from "./wire/commandSchemas.js";
export { decodeSlideQuery } from "./wire/querySchemas.js";
export {
  decodeSlideOperation,
  decodeSlideOperations,
  SlideWireError
} from "./wire/operationSchemas.js";
