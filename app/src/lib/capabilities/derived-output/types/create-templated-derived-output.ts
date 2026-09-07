import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  DerivedOutput,
  DerivedTemplateDefinition
} from "$representation/data/types/semantic/derived-output";

export type CreateTemplatedDerivedOutputInput = {
  readonly template: DerivedTemplateDefinition;
  readonly origin?: ResourceRef;
  readonly scope?: ResourceSet;
};

export type CreateTemplatedDerivedOutputResult = DerivedOutput;
