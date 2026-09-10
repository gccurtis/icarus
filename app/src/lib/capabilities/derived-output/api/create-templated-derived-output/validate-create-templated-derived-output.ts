import { derivedTemplateDefinition } from "$representation/data/behavior/semantic/derived-template";
import {
  inputRecord,
  onlyFields,
  resourceRef,
  resourceSet
} from "$capabilities/derived-output/api/shared/input";
import type { CreateTemplatedDerivedOutputInput } from "$capabilities/derived-output/types/create-templated-derived-output";

export const validateCreateTemplatedDerivedOutput = (
  input: unknown
): CreateTemplatedDerivedOutputInput => {
  const candidate = inputRecord(input, "templated derived output creation input must be an object");
  onlyFields(
    candidate,
    ["template", "scope", "origin"],
    "templated derived output creation"
  );
  return {
    template: derivedTemplateDefinition(candidate.template),
    ...(candidate.origin === undefined ? {} : { origin: resourceRef(candidate.origin) }),
    ...(candidate.scope === undefined ? {} : { scope: resourceSet(candidate.scope) })
  };
};
