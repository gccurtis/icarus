import type { ReadDerivedOutputInput } from "$capabilities/derived-output/types/read-derived-output";
import {
  derivedOutputId,
  inputRecord
} from "$capabilities/derived-output/api/shared/input";

export const validateReadDerivedOutput = (input: unknown): ReadDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output read input must be an object");
  return { derivedOutputId: derivedOutputId(candidate.derivedOutputId) };
};
