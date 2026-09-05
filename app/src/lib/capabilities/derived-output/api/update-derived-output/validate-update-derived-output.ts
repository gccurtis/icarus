import type { UpdateDerivedOutputInput } from "$capabilities/derived-output/types/update-derived-output";
import {
  derivedOutputId,
  inputRecord,
  nonblank,
  resourceSet
} from "$capabilities/derived-output/api/shared/input";

export const validateUpdateDerivedOutput = (input: unknown): UpdateDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output update input must be an object");
  return {
    derivedOutputId: derivedOutputId(candidate.derivedOutputId),
    prompt: nonblank(candidate.prompt, "derived output prompt must not be blank"),
    ...(candidate.scope === undefined ? {} : { scope: resourceSet(candidate.scope) })
  };
};
