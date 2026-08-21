import type { DocumentBody } from "$json-store/types/resources/document-body";
import type { SlideDeckBody } from "$json-store/types/resources/slide-deck-body";
import type { SpreadsheetBody } from "$json-store/types/resources/spreadsheet-body";

/**
 * What a snapshot holds. Told apart by the row's own `generalResourceType`, not
 * by a discriminant inside — being generic over bodies is what lets a deck and a
 * spreadsheet use the same revision machinery.
 */
export type ResourceBody = DocumentBody | SlideDeckBody | SpreadsheetBody;
