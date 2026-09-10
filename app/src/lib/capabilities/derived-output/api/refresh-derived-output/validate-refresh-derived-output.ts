import type { RefreshDerivedOutputInput } from "$capabilities/derived-output/types/refresh-derived-output";
import {
  derivedOutputId,
  inputRecord,
  onlyFields,
  resourceRef
} from "$capabilities/derived-output/api/shared/input";

export const validateRefreshDerivedOutput = (input: unknown): RefreshDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output refresh input must be an object");
  onlyFields(candidate, ["derivedOutputId", "selection"], "derived output refresh input");
  let selection;
  if (candidate.selection !== undefined) {
    const held = inputRecord(candidate.selection, "derived output selection must be an object");
    onlyFields(held, ["ref", "from", "to"], "derived output selection");
    const ref = resourceRef(held.ref);
    if (!Number.isInteger(held.from) || !Number.isInteger(held.to) || (held.from as number) < 0 || (held.to as number) <= (held.from as number) || (held.to as number) - (held.from as number) > 20_000) {
      throw new Error("derived output selection requires a bounded half-open range");
    }
    selection = { ref, from: held.from as number, to: held.to as number };
  }
  return {
    derivedOutputId: derivedOutputId(candidate.derivedOutputId),
    ...(selection === undefined ? {} : { selection })
  };
};
