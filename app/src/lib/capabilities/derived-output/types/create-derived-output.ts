import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

export type CreateDerivedOutputInput = {
  readonly prompt: string;
  readonly scope?: ResourceSet;
};

export type CreateDerivedOutputResult = DerivedOutput;
