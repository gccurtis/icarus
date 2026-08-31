import type { DocumentOp } from "$representation/data/types/revisions/document-op";
import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";

/** A sibling id, or `null` for the head of a list. */
export type After = string | null;

/**
 * Five ops over a path, one set per resource.
 *
 * Every op is closed under inversion, which is what the extra payloads buy:
 * `was` reverses a set, `values` and `after` reverse a remove, `wasAfter`
 * reverses a move. An undo is an ordinary change set, not a rewind.
 *
 * `value` and `values` are `unknown` because a payload is whatever sits at the
 * path. Naming them would be this type knowing what a slide is.
 *
 * The three unions name only their own resource's targets, so a table typed to
 * one of them cannot hold another's op.
 */
export type AnyOp = DocumentOp | SlideDeckOp | SpreadsheetOp;
