export { createSlideCapability } from "./application/slideService.js";
export type {
  SlideCapability,
  SlideDependencies
} from "./application/slideService.js";
export {
  createBlankDeckSnapshot,
  createDefaultSlideStyles,
  DEFAULT_SLIDE_CANVAS,
  DEFAULT_SLIDE_OPTIONS
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
  digestSnapshot
} from "./domain/canonical.js";
export { validateSnapshot } from "./domain/validation.js";
export * from "./domain/geometry.js";
export * from "./domain/tree.js";
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
export type { SlideStore } from "./ports/slideStore.js";
export type { SlideDerivedOutputs } from "./ports/derivedOutputs.js";
export { SQLiteSlideStore } from "./persistence/sqliteSlideStore.js";
export { decodeSlideCommand } from "./wire/commandSchemas.js";
export { decodeSlideQuery } from "./wire/querySchemas.js";
export {
  decodeSlideOperation,
  decodeSlideOperations,
  SLIDE_WIRE_LIMITS,
  SlideWireError
} from "./wire/operationSchemas.js";
export {
  projectSlidePlainText
} from "./projections/plainText.js";
export {
  projectSlideOutline
} from "./projections/outline.js";
export type {
  SlideOutlineItem
} from "./projections/outline.js";
export {
  projectSlideDependencies
} from "./projections/dependencies.js";
export type {
  SlideDependenciesProjection
} from "./projections/dependencies.js";
export {
  projectSlideShapeStyle,
  projectSlideTextStyling
} from "./projections/styling.js";
export type {
  ResolvedSlideShapeStyle,
  ResolvedSlideTextStyling
} from "./projections/styling.js";
