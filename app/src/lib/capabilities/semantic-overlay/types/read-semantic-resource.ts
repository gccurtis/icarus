import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SemanticResourceProjection } from "$representation/data/types/semantic/source";

export type ReadSemanticResourceInput = {
  readonly ref: ResourceRef;
};

export type ReadSemanticResourceResult = SemanticResourceProjection | null;
