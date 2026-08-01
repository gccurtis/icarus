export {
  createDocumentCapability
} from "./application/documentService.js";
export type {
  DocumentCapability,
  DocumentDependencies
} from "./application/documentService.js";
export {
  createBlankSnapshot,
  createDefaultDocumentStyles,
  DEFAULT_DOCUMENT_PAGE_LAYOUT
} from "./application/createService.js";
export * from "./domain/model.js";
export * from "./domain/errors.js";
export {
  applyOperations,
  applyWithoutValidation,
  computeTouchedIds,
  resolveDocumentStyle
} from "./domain/reducer.js";
export { invertOperations } from "./domain/inverses.js";
export { canRebase } from "./domain/rebase.js";
export {
  canonicalize,
  canonicalDigest,
  canonicalizeSnapshot,
  digestFormulaExpression,
  digestSnapshot
} from "./domain/canonical.js";
export { validateSnapshot } from "./domain/validation.js";
export {
  computeAssignedBlockWidth,
  computeUsablePageHeight,
  computeUsablePageWidth
} from "./domain/layout.js";
export {
  collectDocumentIdentities,
  computeDocumentIdentityTransitions
} from "./domain/identities.js";
export type {
  DocumentIdentity,
  DocumentIdentityKind,
  DocumentIdentityLedgerEntry,
  DocumentIdentityLedgerState,
  DocumentIdentityReactivation,
  DocumentIdentityTransitions
} from "./domain/identities.js";
export type { DocumentStore } from "./ports/documentStore.js";
export type { DocumentDerivedOutputs } from "./ports/derivedOutputs.js";
export type { DocumentFormulaResolver } from "./ports/formulaResolver.js";
export { SQLiteDocumentStore } from "./persistence/sqliteDocumentStore.js";
export { decodeDocumentCommand } from "./wire/commandSchemas.js";
export { decodeDocumentQuery } from "./wire/querySchemas.js";
export { decodeDocumentOperation, DocumentWireError } from "./wire/operationSchemas.js";
export { projectDocumentPlainText } from "./projections/plainText.js";
export { projectDocumentOutline } from "./projections/outline.js";
export { projectDocumentDependencies } from "./projections/dependencies.js";
export {
  projectDocumentBlockStyle,
  projectDocumentTextStyling
} from "./projections/styling.js";
export type {
  DocumentTextBearingBlock,
  ResolvedDocumentBlockStyle,
  ResolvedDocumentTextStyling
} from "./projections/styling.js";
