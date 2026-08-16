import { v } from "convex/values";
import { documentBodyValidator, type DocumentBody } from "$documents/types/body";
import { slideDeckBodyValidator, type SlideDeckBody } from "$slide-decks/types/body";
import { spreadsheetBodyValidator, type SpreadsheetBody } from "$spreadsheets/types/body";

/**
 * What a snapshot's `body` may be: one of the three general resources' bodies,
 * told apart by the row's own `resourceType`.
 *
 * **This is the only place all three are named together, and it imports them
 * rather than declaring them.** A body's shape is its resource's model — a deck
 * body belongs to `slide-decks` — and stating them here would be this capability
 * knowing what a slide is, which is the one thing that would stop the machinery
 * being generic.
 *
 * A union rather than `v.any()`: per-type validation *and* one implementation,
 * rather than a choice between them. Nothing reads this union at runtime; the
 * schema does, at the door, which is where a malformed body should be refused.
 *
 * The three are structurally disjoint — `rows`, `slides`, `sheets` — and Convex
 * objects reject unknown fields, so membership is unambiguous without a
 * discriminant inside the body. The discriminant is the column beside it.
 */
export const resourceBodyValidator = v.union(
  documentBodyValidator,
  slideDeckBodyValidator,
  spreadsheetBodyValidator
);

export type ResourceBody = DocumentBody | SlideDeckBody | SpreadsheetBody;
