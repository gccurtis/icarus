import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  DerivedOutput,
  DerivedTemplateDefinition
} from "$representation/data/types/semantic/derived-output";

export type CreateTemplatedDerivedOutputInput = {
  readonly template: DerivedTemplateDefinition;
  readonly scope?: ResourceSet;
};

export type CreateTemplatedDerivedOutputResult = DerivedOutput;
