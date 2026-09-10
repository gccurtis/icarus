import type { ReadDerivedOutputInput } from "$capabilities/derived-output/types/read-derived-output";
import {
  derivedOutputId,
  inputRecord,
  onlyFields
} from "$capabilities/derived-output/api/shared/input";

export const validateReadDerivedOutput = (input: unknown): ReadDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output read input must be an object");
  onlyFields(candidate, ["derivedOutputId"], "derived output read input");
  return { derivedOutputId: derivedOutputId(candidate.derivedOutputId) };
};
