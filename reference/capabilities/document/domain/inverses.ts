import type { RichText } from "#rich-text";
import type {
  DocumentLimits,
  DocumentOperation,
  DocumentSnapshot
} from "./model.js";
import { applyOperations } from "./reducer.js";

/**
 * Compute exact inverse operations through the same reducer used by admission.
 * Kept as a separate domain entry point so callers never synthesize inverses.
 */
export const invertOperations = (
  before: DocumentSnapshot,
  operations: DocumentOperation[],
  richText: RichText,
  limits: DocumentLimits
): DocumentOperation[] => applyOperations(before, operations, richText, limits).inverse;
