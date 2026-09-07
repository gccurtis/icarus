import { derivedTemplateDefinition } from "$representation/data/behavior/semantic/derived-template";
import {
  inputRecord,
  resourceRef,
  resourceSet
} from "$capabilities/derived-output/api/shared/input";
import type { CreateTemplatedDerivedOutputInput } from "$capabilities/derived-output/types/create-templated-derived-output";

export const validateCreateTemplatedDerivedOutput = (
  input: unknown
): CreateTemplatedDerivedOutputInput => {
  const candidate = inputRecord(input, "templated derived output creation input must be an object");
  const unexpected = Object.keys(candidate).find(
    (key) => key !== "template" && key !== "scope" && key !== "origin"
  );
  if (unexpected !== undefined) {
    throw new Error(`templated derived output creation has unexpected field '${unexpected}'`);
  }
  return {
    template: derivedTemplateDefinition(candidate.template),
    ...(candidate.origin === undefined ? {} : { origin: resourceRef(candidate.origin) }),
    ...(candidate.scope === undefined ? {} : { scope: resourceSet(candidate.scope) })
  };
};
