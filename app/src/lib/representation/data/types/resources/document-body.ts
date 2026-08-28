import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { PageSetup } from "$representation/data/types/resources/page-setup";
import type { StyleSet } from "$representation/data/types/resources/style-set";

/**
 * A document is rows, and a row is one of three things.
 *
 * A divider and a page break are not blocks: they hold no content, take no
 * marks, and cannot be searched. Content and structure split there.
 */
export type DocumentRow =
  | { id: string; kind: "blocks"; blocks: ContentBlock[]; proportions?: number[] }
  | {
      id: string;
      kind: "divider";
      color?: string;
      width?: number;
      style?: "solid" | "dashed" | "dotted";
    }
  | { id: string; kind: "pageBreak" };

export type PageNumbering = {
  position: "start" | "center" | "end";
  format?: string;
  startAt?: number;
  hideOnFirstPage?: boolean;
};

/**
 * What is printed around the content rather than in it. Rows rather than blocks,
 * so a header can hold a divider, and a distance from the page edge, because
 * margins are the content boundary and furniture sits outside them.
 */
export type PageFurniture = {
  rows: DocumentRow[];
  /** Absent means every page gets the same. */
  firstPageRows?: DocumentRow[];
  distanceFromEdge: number;
  pageNumber?: PageNumbering;
};

/** Styles and page setup live in the body, so restyling is an ordinary change an undo reaches. */
export type DocumentBody = {
  pageSetup?: PageSetup;
  styles?: StyleSet;
  rows: DocumentRow[];
  header?: PageFurniture;
  footer?: PageFurniture;
};
