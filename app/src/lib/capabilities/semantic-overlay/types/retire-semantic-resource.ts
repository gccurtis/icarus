import type { ResourceRef } from "$representation/data/types/core/resource";

export type RetireSemanticResourceInput = {
  readonly ref: ResourceRef;
};

export type RetireSemanticResourceResult = {
  readonly ref: ResourceRef;
  readonly exactSources: number;
  readonly materials: number;
  readonly objects: number;
  readonly placements: number;
  readonly jobs: number;
  readonly generationBefore: number;
  readonly generationAfter: number;
};
