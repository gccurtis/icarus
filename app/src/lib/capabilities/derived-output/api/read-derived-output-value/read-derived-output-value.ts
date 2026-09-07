import { requireScope } from "$runtime/server/scope.server";
import { readDerivedOutput } from "$capabilities/derived-output/api/read-derived-output/read-derived-output";
import type {
  ReadDerivedOutputValueInput,
  ReadDerivedOutputValueResult
} from "$capabilities/derived-output/types/read-derived-output-value";
import { validateReadDerivedOutput } from "$capabilities/derived-output/api/read-derived-output/validate-read-derived-output";

/** Stable value adapter: callers need not understand the full generation row. */
export const readDerivedOutputValue = async (
  input: unknown
): Promise<ReadDerivedOutputValueResult> => {
  await requireScope();
  const asked = validateReadDerivedOutput(input) as ReadDerivedOutputValueInput;
  const read = await readDerivedOutput(asked);
  if (read === null) return null;
  const block = read.output.lastResponse ?? null;
  return {
    derivedOutputId: read.output._id,
    value: block !== null && "display" in block ? block.display : null,
    block,
    state: read.effectiveState,
    refresh: read.refresh,
    revision: read.output.lastRevision ?? null,
    variables: read.output.lastVariables ?? [],
    evidence: read.output.evidence
  };
};
