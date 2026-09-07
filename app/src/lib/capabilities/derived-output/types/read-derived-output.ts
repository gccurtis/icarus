import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";
import type { SemanticMaterialSnapshot } from "$representation/data/types/semantic/material";

export type ReadDerivedOutputInput = {
  readonly derivedOutputId: Id<"derivedOutputs">;
};

export type DerivedOutputEffectiveState = "idle" | "fresh" | "stale" | "error";

export type DerivedOutputRefreshStatus =
  | { readonly state: "idle" }
  | {
      readonly state: "queued" | "running" | "failed";
      readonly queuedAt: number;
      readonly startedAt?: number;
      readonly error?: string;
    };

export type ReadDerivedOutputResult = {
  readonly output: DerivedOutput;
  /** Value state only; in-flight operation state is exposed separately. */
  readonly effectiveState: DerivedOutputEffectiveState;
  /** Shared server state for the one coalesced refresh job. */
  readonly refresh: DerivedOutputRefreshStatus;
  readonly changedSources: SemanticSourceSnapshot[];
  readonly changedMaterials: SemanticMaterialSnapshot[];
} | null;
