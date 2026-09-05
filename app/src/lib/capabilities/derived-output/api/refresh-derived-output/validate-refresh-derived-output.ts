import type { RefreshDerivedOutputInput } from "$capabilities/derived-output/types/refresh-derived-output";
import {
  derivedOutputId,
  inputRecord
} from "$capabilities/derived-output/api/shared/input";

export const validateRefreshDerivedOutput = (input: unknown): RefreshDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output refresh input must be an object");
  return { derivedOutputId: derivedOutputId(candidate.derivedOutputId) };
};
