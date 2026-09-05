import type { Id } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

export type UpdateDerivedOutputInput = {
  readonly derivedOutputId: Id<"derivedOutputs">;
  readonly prompt: string;
  readonly scope?: ResourceSet;
};

export type UpdateDerivedOutputResult = DerivedOutput | null;
