import type { CreateDerivedOutputInput } from "$capabilities/derived-output/types/create-derived-output";
import {
  inputRecord,
  nonblank,
  resourceRef,
  resourceSet
} from "$capabilities/derived-output/api/shared/input";

export const validateCreateDerivedOutput = (input: unknown): CreateDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output creation input must be an object");
  return {
    prompt: nonblank(candidate.prompt, "derived output prompt must not be blank"),
    ...(candidate.origin === undefined ? {} : { origin: resourceRef(candidate.origin) }),
    ...(candidate.scope === undefined ? {} : { scope: resourceSet(candidate.scope) })
  };
};
