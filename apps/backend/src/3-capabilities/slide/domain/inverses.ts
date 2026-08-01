import type { RichText } from "#rich-text";
import type {
  DeckSnapshot,
  SlideLimits,
  SlideOperation
} from "./model.js";
import { applyOperations } from "./reducer.js";

/** Compute exact inverse operations through the same pure reducer as admission. */
export const invertOperations = (
  before: DeckSnapshot,
  operations: SlideOperation[],
  richText: RichText,
  limits: SlideLimits
): SlideOperation[] => applyOperations(before, operations, richText, limits).inverse;
