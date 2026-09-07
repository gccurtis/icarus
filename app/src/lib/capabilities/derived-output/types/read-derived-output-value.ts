import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type {
  DerivedState,
  DerivedVariableResolution,
  SemanticCitation
} from "$representation/data/types/semantic/derived-output";

export type ReadDerivedOutputValueInput = {
  readonly derivedOutputId: Id<"derivedOutputs">;
};

/** The presentation-facing projection consumed by prompt/content blocks. */
export type ReadDerivedOutputValueResult = {
  readonly derivedOutputId: Id<"derivedOutputs">;
  readonly value: string | null;
  readonly block: ContentBlock | null;
  readonly state: DerivedState;
  readonly revision: number | null;
  readonly variables: readonly DerivedVariableResolution[];
  readonly evidence: readonly SemanticCitation[];
} | null;
