import {
  DERIVED_OUTPUT_INSUFFICIENT_TEXT,
  DERIVED_OUTPUT_SYSTEM_PROMPT
} from "$capabilities/derived-output/api/shared/agent-instructions";
import { synthesisEnvironment } from "$capabilities/derived-output/api/shared/synthesis-environment";
import {
  resolveEvidenceSelections,
  validSelections
} from "$capabilities/derived-output/api/shared/synthesis-evidence";
import {
  synthesisDecision,
  synthesisSchema
} from "$capabilities/derived-output/api/shared/synthesis-parsing";
import {
  oneParagraph,
  synthesisUserPrompt
} from "$capabilities/derived-output/api/shared/synthesis-prompts";
import { synthesizeTemplate } from "$capabilities/derived-output/api/shared/synthesis-template";
import type {
  SynthesisAttempt,
  SynthesisInput
} from "$capabilities/derived-output/api/shared/synthesis-types";

export type { SynthesisAttempt } from "$capabilities/derived-output/api/shared/synthesis-types";
export {
  materialDescriptorEvidence,
  resolveEvidenceSelections
} from "$capabilities/derived-output/api/shared/synthesis-evidence";

export const synthesize = async (input: SynthesisInput): Promise<SynthesisAttempt> => {
  if (input.output.template !== undefined) return synthesizeTemplate(input);
  const attempt = synthesisEnvironment(input);
  const result = await input.intelligence.completeWithTools({
    system: DERIVED_OUTPUT_SYSTEM_PROMPT,
    user: synthesisUserPrompt(input.output),
    firstTool: attempt.firstTool,
    output: {
      name: "semantic_derived_output",
      description: "A grounded answer and issued evidence identifiers",
      schema: synthesisSchema,
      parse: synthesisDecision
    },
    tools: attempt.tools,
    ...(input.signal === undefined ? {} : { signal: input.signal })
  });
  const valid =
    result.value.status === "answered" &&
    result.value.response.trim().length > 0 &&
    validSelections(result.value.evidence, attempt.issued);
  const citations = valid
    ? resolveEvidenceSelections(result.value.evidence, attempt.issued)
    : [];
  return {
    status: citations.length === 0 ? "insufficient" : "answered",
    text:
      citations.length === 0
        ? DERIVED_OUTPUT_INSUFFICIENT_TEXT
        : oneParagraph(result.value.response),
    queries: attempt.queries,
    overlayGenerations: attempt.overlayGenerations,
    evidence: citations,
    embeddingUsage: attempt.embeddingUsage,
    intelligenceUsage: result.usage,
    toolCalls: result.toolCalls.length
  };
};
