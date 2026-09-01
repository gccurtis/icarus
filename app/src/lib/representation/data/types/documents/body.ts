import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { PageSetup } from "$representation/data/types/documents/page-setup";
import type { StyleSet } from "$representation/data/types/documents/style-set";

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

export type PageFurniture = {
  rows: DocumentRow[];
  firstPageRows?: DocumentRow[];
  distanceFromEdge: number;
  pageNumber?: PageNumbering;
};

export type DocumentBody = {
  pageSetup?: PageSetup;
  styles?: StyleSet;
  rows: DocumentRow[];
  header?: PageFurniture;
  footer?: PageFurniture;
};
