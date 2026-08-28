import type { DocumentBody } from "$representation/data/types/resources/document-body";
import type { SlideDeckBody } from "$representation/data/types/resources/slide-deck-body";
import type { SpreadsheetBody } from "$representation/data/types/resources/spreadsheet-body";

/**
 * What a snapshot holds. Told apart by the row's own `generalResourceType`, not
 * by a discriminant inside — being generic over bodies is what lets a deck and a
 * spreadsheet use the same revision machinery.
 */
export type ResourceBody = DocumentBody | SlideDeckBody | SpreadsheetBody;
