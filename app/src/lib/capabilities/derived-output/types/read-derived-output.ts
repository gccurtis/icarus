import type { Id } from "$representation/data/types/core/id";
import type { DerivedState } from "$representation/data/types/semantic/derived-output";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";
import type { SemanticMaterialSnapshot } from "$representation/data/types/semantic/material";

export type ReadDerivedOutputInput = {
  readonly derivedOutputId: Id<"derivedOutputs">;
};

export type ReadDerivedOutputResult = {
  readonly output: DerivedOutput;
  /** Stored state plus a pull-time source revision check. */
  readonly effectiveState: DerivedState;
  readonly changedSources: SemanticSourceSnapshot[];
  readonly changedMaterials: SemanticMaterialSnapshot[];
} | null;
