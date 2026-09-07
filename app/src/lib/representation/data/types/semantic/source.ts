import type { ResourceRef } from "$representation/data/types/core/resource";

/**
 * The coordinate system used by every span derived from a semantic source.
 * UTF-8 offsets count bytes; UTF-16 offsets count 16-bit code units.
 */
export type SemanticEncoding = "utf-8" | "utf-16";

/** Where one projected text segment came from in its authoritative resource. */
export type SemanticLocator =
  /** Read compatibility for citations produced before resource names became metadata-only. */
  | { kind: "resourceTitle" }
  | {
      kind: "documentBlock";
      area: "body" | "header" | "firstPageHeader" | "footer" | "firstPageFooter";
      rowId: string;
      blockPath: string[];
    }
  | {
      kind: "slideElement";
      slideId: string;
      elementPath: string[];
      blockPath: string[];
    }
  | { kind: "slideNote"; slideId: string; blockPath: string[] }
  | { kind: "externalFileContent" };

/** A half-open range in projected UTF-16 text that can be read from the source again. */
export type SemanticLocatorSpan = {
  from: number;
  to: number;
  locator: SemanticLocator;
};

/** The transient, project-scoped message accepted by semantic translation. */
export type SemanticSourceInput = {
  ref: ResourceRef;
  revision: number;
  /** Immutable native-content identity for sources that do not use numeric revisions. */
  contentHash?: string;
  text: string;
  encoding: SemanticEncoding;
  /** Optional at the algorithm seam; authoritative resource projection always supplies it. */
  locators?: SemanticLocatorSpan[];
  /** Out-of-band offsets that semantic spans may touch but never cross. */
  hardBoundaries?: number[];
};

/** The canonical, revisioned text view consumed by semantic translation. */
export type SemanticResourceProjection = SemanticSourceInput & {
  encoding: "utf-16";
  locators: SemanticLocatorSpan[];
  hardBoundaries: number[];
};

/** A self-contained source reference that remains meaningful after replacement. */
export type SemanticSourceSnapshot = {
  ref: ResourceRef;
  revision: number;
  contentHash?: string;
  encoding: SemanticEncoding;
};
