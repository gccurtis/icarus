import { renderDerivedTemplate } from "$representation/data/behavior/semantic/derived-template";
import type { DerivedVariableResolution } from "$representation/data/types/semantic/derived-output";
import {
  DERIVED_OUTPUT_INSUFFICIENT_TEXT,
  DERIVED_TEMPLATE_SYSTEM_PROMPT
} from "$capabilities/derived-output/api/shared/agent-instructions";
import { synthesisEnvironment } from "$capabilities/derived-output/api/shared/synthesis-environment";
import {
  resolveEvidenceSelections,
  validSelections
} from "$capabilities/derived-output/api/shared/synthesis-evidence";
import {
  templateDecision,
  templateSchema,
  type VariableDecision
} from "$capabilities/derived-output/api/shared/synthesis-parsing";
import {
  oneParagraph,
  templateUserPrompt
} from "$capabilities/derived-output/api/shared/synthesis-prompts";
import type {
  EvidenceSelection,
  SynthesisAttempt,
  SynthesisInput
} from "$capabilities/derived-output/api/shared/synthesis-types";

export const synthesizeTemplate = async (
  input: SynthesisInput
): Promise<SynthesisAttempt> => {
  const template = input.output.template;
  if (template === undefined) throw new Error("A templated synthesis requires a template");
  const attempt = synthesisEnvironment(input);
  const result = await input.intelligence.completeWithTools({
    system: DERIVED_TEMPLATE_SYSTEM_PROMPT,
    user: templateUserPrompt(input.output),
    firstTool: attempt.firstTool,
    output: {
      name: "semantic_derived_variables",
      description: "Named grounded values and issued evidence identifiers",
      schema: templateSchema,
      parse: templateDecision
    },
    tools: attempt.tools,
    ...(input.signal === undefined ? {} : { signal: input.signal })
  });
  const expected = template.variables.map((variable) => variable.name);
  const actual = result.value.variables.map((variable) => variable.name);
  const exactNames =
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((name) => actual.includes(name));
  const grounded = exactNames
    ? expected
        .map((name) => result.value.variables.find((variable) => variable.name === name))
        .filter(
          (decision): decision is VariableDecision =>
            decision !== undefined &&
            decision.status === "answered" &&
            decision.value.trim().length > 0 &&
            validSelections(decision.evidence, attempt.issued)
        )
    : [];
  const allGrounded = grounded.length === expected.length;
  const variables: DerivedVariableResolution[] = allGrounded
    ? grounded.map((decision) => ({
        name: decision.name,
        value: oneParagraph(decision.value),
        evidence: decision.evidence
      }))
    : [];
  const uses = new Map<string, string[]>();
  if (allGrounded) {
    for (const selection of grounded.flatMap((decision) => decision.evidence)) {
      const held = uses.get(selection.evidenceId) ?? [];
      if (!held.includes(selection.use)) held.push(selection.use);
      uses.set(selection.evidenceId, held);
    }
  }
  const selected: EvidenceSelection[] = [...uses].map(([evidenceId, values]) => ({
    evidenceId,
    use: values.join("; ")
  }));
  const citations = resolveEvidenceSelections(selected, attempt.issued);
  const answered = allGrounded && citations.length > 0;
  return {
    status: answered ? "answered" : "insufficient",
    text: answered
      ? renderDerivedTemplate(template, variables)
      : DERIVED_OUTPUT_INSUFFICIENT_TEXT,
    queries: attempt.queries,
    overlayGenerations: attempt.overlayGenerations,
    evidence: answered ? citations : [],
    variables: answered ? variables : [],
    embeddingUsage: attempt.embeddingUsage,
    intelligenceUsage: result.usage,
    toolCalls: result.toolCalls.length
  };
};
