import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  GeneratedMaterialDescriptor,
  MaterialKind,
  MaterialProfileDigest
} from "$representation/data/types/semantic/material";

export type SemanticLaneState =
  | "unsupported"
  | "not-started"
  | "queued"
  | "running"
  | "failed"
  | "stale"
  | "current";

export type SemanticLaneStatus = {
  readonly eligible: boolean;
  readonly state: SemanticLaneState;
  readonly updatedAt?: number;
  readonly error?: string;
};

export type ExactSemanticStatus = SemanticLaneStatus & {
  readonly objectCount: number;
};

export type MaterialSemanticStatus = SemanticLaneStatus & {
  readonly kind?: MaterialKind;
  readonly profile?: MaterialProfileDigest;
  readonly descriptor?: GeneratedMaterialDescriptor;
};

export type ReadSemanticStatusInput = {
  readonly ref: ResourceRef;
};

export type ReadSemanticStatusResult = {
  readonly ref: ResourceRef;
  readonly overlayGeneration: number;
  readonly exact: ExactSemanticStatus;
  readonly material: MaterialSemanticStatus;
} | null;
