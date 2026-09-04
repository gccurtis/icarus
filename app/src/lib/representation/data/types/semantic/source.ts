import type { ResourceRef } from "$representation/data/types/core/resource";

/**
 * The coordinate system used by every span derived from a semantic source.
 * UTF-8 offsets count bytes; UTF-16 offsets count 16-bit code units.
 */
export type SemanticEncoding = "utf-8" | "utf-16";

/** The transient, project-scoped message accepted by semantic translation. */
export type SemanticSourceInput = {
  ref: ResourceRef;
  revision: number;
  text: string;
  encoding: SemanticEncoding;
};

/** A self-contained source reference that remains meaningful after replacement. */
export type SemanticSourceSnapshot = {
  ref: ResourceRef;
  revision: number;
  encoding: SemanticEncoding;
};
