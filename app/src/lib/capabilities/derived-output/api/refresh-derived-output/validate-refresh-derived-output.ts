import type { RefreshDerivedOutputInput } from "$capabilities/derived-output/types/refresh-derived-output";
import {
  derivedOutputId,
  inputRecord
} from "$capabilities/derived-output/api/shared/input";

export const validateRefreshDerivedOutput = (input: unknown): RefreshDerivedOutputInput => {
  const candidate = inputRecord(input, "derived output refresh input must be an object");
  let selection;
  if (candidate.selection !== undefined) {
    const held = inputRecord(candidate.selection, "derived output selection must be an object");
    const ref = inputRecord(held.ref, "derived output selection ref must be an object");
    if (typeof ref.kind !== "string" || !ref.kind.trim() || typeof ref.id !== "string" || !ref.id.trim()) {
      throw new Error("derived output selection requires a resource ref");
    }
    if (!Number.isInteger(held.from) || !Number.isInteger(held.to) || (held.from as number) < 0 || (held.to as number) <= (held.from as number) || (held.to as number) - (held.from as number) > 20_000) {
      throw new Error("derived output selection requires a bounded half-open range");
    }
    selection = { ref: { kind: ref.kind.trim(), id: ref.id.trim() }, from: held.from as number, to: held.to as number };
  }
  return {
    derivedOutputId: derivedOutputId(candidate.derivedOutputId),
    ...(selection === undefined ? {} : { selection })
  };
};
