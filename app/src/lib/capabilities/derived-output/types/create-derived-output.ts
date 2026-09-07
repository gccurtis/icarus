import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

export type CreateDerivedOutputInput = {
  readonly prompt: string;
  readonly origin?: ResourceRef;
  readonly scope?: ResourceSet;
};

export type CreateDerivedOutputResult = DerivedOutput;
