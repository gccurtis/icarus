import type {
  IntelligenceModel,
  IntelligenceUsage
} from "$model/server/intelligence/index.server";
import { coalesceSemanticCitations } from "$representation/data/behavior/semantic/citation";
import { renderDerivedTemplate } from "$representation/data/behavior/semantic/derived-template";
import type {
  DerivedOutput,
  DerivedVariableResolution,
  SemanticCitation
} from "$representation/data/types/semantic/derived-output";
import type { SemanticHit } from "$representation/data/types/semantic/index";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import type {
  QuerySemanticOverlayInput,
  QuerySemanticOverlayResult
} from "$capabilities/semantic-overlay/index.remote";
import {
  DERIVED_OUTPUT_INSUFFICIENT_TEXT,
  DERIVED_OUTPUT_SYSTEM_PROMPT,
  DERIVED_TEMPLATE_SYSTEM_PROMPT
} from "$capabilities/derived-output/api/shared/agent-instructions";

export type SynthesisAttempt = {
  readonly status: "answered" | "insufficient";
  readonly text: string;
  readonly queries: string[];
  readonly overlayGenerations: number[];
  readonly evidence: SemanticCitation[];
  readonly variables?: DerivedVariableResolution[];
  readonly embeddingUsage: ProviderUsage[];
  readonly intelligenceUsage: IntelligenceUsage;
  readonly toolCalls: number;
};

type SynthesisInput = {
  readonly output: DerivedOutput;
  readonly intelligence: IntelligenceModel;
  readonly defaultTopK: number;
  query(input: QuerySemanticOverlayInput): Promise<QuerySemanticOverlayResult>;
};

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const queryInput = (value: unknown, defaultTopK: number): { query: string; topK: number } => {
  const candidate = record(value, "retrieve input must be an object");
  if (typeof candidate.query !== "string" || !candidate.query.trim()) {
    throw new Error("retrieve query must not be blank");
  }
  if (candidate.query.length > 2_000) throw new Error("retrieve query is too long");
  const topK = candidate.topK ?? defaultTopK;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 20) {
    throw new Error("retrieve topK must be an integer from 1 through 20");
  }
  return { query: candidate.query.trim(), topK: topK as number };
};

type EvidenceSelection = { evidenceId: string; use: string };

/** Resolves only attempt-issued IDs and copies their trusted hit values into citations. */
export const resolveEvidenceSelections = (
  selections: readonly EvidenceSelection[],
  issued: ReadonlyMap<string, SemanticHit>
): SemanticCitation[] =>
  coalesceSemanticCitations(
    selections.map((selection): SemanticCitation => {
      const hit = issued.get(selection.evidenceId);
      if (hit === undefined) throw new Error("selected evidence disappeared from its attempt");
      return {
        selections: [selection],
        source: hit.source,
        span: hit.span,
        ...(hit.locators === undefined ? {} : { locators: hit.locators }),
        overlayGeneration: hit.overlayGeneration
      };
    })
  );

type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: EvidenceSelection[];
};

const synthesisDecision = (value: unknown): SynthesisDecision => {
  const candidate = record(value, "synthesis decision must be an object");
  if (candidate.status !== "answered" && candidate.status !== "insufficient") {
    throw new Error("synthesis decision has an invalid status");
  }
  if (typeof candidate.response !== "string") {
    throw new Error("synthesis decision response must be text");
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length > 200) {
    throw new Error("synthesis decision evidence must be an array of at most 200 items");
  }
  const evidence = candidate.evidence.map((value): EvidenceSelection => {
    const selection = record(value, "synthesis evidence selection must be an object");
    if (typeof selection.evidenceId !== "string" || !selection.evidenceId.trim()) {
      throw new Error("synthesis evidence id must not be blank");
    }
    if (typeof selection.use !== "string" || !selection.use.trim()) {
      throw new Error("synthesis evidence use must not be blank");
    }
    return { evidenceId: selection.evidenceId.trim(), use: selection.use.trim() };
  });
  return { status: candidate.status, response: candidate.response, evidence };
};

const synthesisSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "insufficient"] },
    response: { type: "string" },
    evidence: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        properties: {
          evidenceId: { type: "string" },
          use: { type: "string" }
        },
        required: ["evidenceId", "use"],
        additionalProperties: false
      }
    }
  },
  required: ["status", "response", "evidence"],
  additionalProperties: false
} as const;

const hitKey = (hit: SemanticHit): string =>
  JSON.stringify([
    hit.source.ref.kind,
    hit.source.ref.id,
    hit.source.revision,
    hit.source.encoding,
    hit.span.from,
    hit.span.to,
    hit.overlayGeneration
  ]);

const previousResponse = (output: DerivedOutput): string | undefined =>
  output.lastResponse?.type === "text" ? output.lastResponse.display : undefined;

const userPrompt = (output: DerivedOutput): string => {
  const previous = previousResponse(output);
  return [
    `Task: ${output.prompt}`,
    previous === undefined
      ? "There is no previous response."
      : `Previous response for stylistic continuity only (never factual evidence): ${previous}`
  ].join("\n\n");
};

const oneParagraph = (text: string): string => text.replace(/\s+/g, " ").trim();

type VariableDecision = {
  name: string;
  status: "answered" | "insufficient";
  value: string;
  evidence: EvidenceSelection[];
};

const variableDecision = (value: unknown): VariableDecision => {
  const candidate = record(value, "derived variable decision must be an object");
  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    throw new Error("derived variable decision name must not be blank");
  }
  if (candidate.status !== "answered" && candidate.status !== "insufficient") {
    throw new Error("derived variable decision has an invalid status");
  }
  if (typeof candidate.value !== "string") {
    throw new Error("derived variable decision value must be text");
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length > 200) {
    throw new Error("derived variable evidence must be an array of at most 200 items");
  }
  const evidence = candidate.evidence.map((value): EvidenceSelection => {
    const selection = record(value, "derived variable evidence must be an object");
    if (typeof selection.evidenceId !== "string" || !selection.evidenceId.trim()) {
      throw new Error("derived variable evidence id must not be blank");
    }
    if (typeof selection.use !== "string" || !selection.use.trim()) {
      throw new Error("derived variable evidence use must not be blank");
    }
    return { evidenceId: selection.evidenceId.trim(), use: selection.use.trim() };
  });
  return {
    name: candidate.name.trim(),
    status: candidate.status,
    value: candidate.value,
    evidence
  };
};

const templateDecision = (value: unknown): { variables: VariableDecision[] } => {
  const candidate = record(value, "templated synthesis decision must be an object");
  if (!Array.isArray(candidate.variables) || candidate.variables.length > 32) {
    throw new Error("templated synthesis variables must be an array of at most 32 items");
  }
  return { variables: candidate.variables.map(variableDecision) };
};

const templateSchema = {
  type: "object",
  properties: {
    variables: {
      type: "array",
      maxItems: 32,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["answered", "insufficient"] },
          value: { type: "string" },
          evidence: {
            type: "array",
            maxItems: 200,
            items: {
              type: "object",
              properties: {
                evidenceId: { type: "string" },
                use: { type: "string" }
              },
              required: ["evidenceId", "use"],
              additionalProperties: false
            }
          }
        },
        required: ["name", "status", "value", "evidence"],
        additionalProperties: false
      }
    }
  },
  required: ["variables"],
  additionalProperties: false
} as const;

const templateUserPrompt = (output: DerivedOutput): string => {
  if (output.template === undefined) throw new Error("A templated synthesis requires a template");
  const previous = previousResponse(output);
  return [
    "Variables to resolve:",
    ...output.template.variables.map(
      (variable) => `- ${variable.name}: ${variable.prompt}`
    ),
    `Output template (structure only): ${output.template.output}`,
    output.template.exampleResponse === undefined
      ? "There is no example response."
      : `Example response for format and style only (never factual evidence): ${output.template.exampleResponse}`,
    previous === undefined
      ? "There is no previous response."
      : `Previous response for stylistic continuity only (never factual evidence): ${previous}`
  ].join("\n\n");
};

const synthesizeTemplate = async (input: SynthesisInput): Promise<SynthesisAttempt> => {
  const template = input.output.template;
  if (template === undefined) throw new Error("A templated synthesis requires a template");
  const issued = new Map<string, SemanticHit>();
  const evidenceByHit = new Map<string, string>();
  const queries: string[] = [];
  const overlayGenerations: number[] = [];
  const embeddingUsage: ProviderUsage[] = [];
  let nextEvidence = 1;

  const retrieve = async (value: unknown) => {
    const asked = queryInput(value, input.defaultTopK);
    if (!queries.includes(asked.query)) queries.push(asked.query);
    const result = await input.query({
      text: asked.query,
      topK: asked.topK,
      ...(input.output.scope === undefined ? {} : { scope: input.output.scope })
    });
    if (!overlayGenerations.includes(result.overlayGeneration)) {
      overlayGenerations.push(result.overlayGeneration);
    }
    embeddingUsage.push(...result.usage);
    return {
      hits: result.hits.map((hit) => {
        const key = hitKey(hit);
        let evidenceId = evidenceByHit.get(key);
        if (evidenceId === undefined) {
          evidenceId = `evidence-${nextEvidence}`;
          nextEvidence += 1;
          evidenceByHit.set(key, evidenceId);
          issued.set(evidenceId, hit);
        }
        return {
          evidenceId,
          source: hit.source,
          span: hit.span,
          ...(hit.locators === undefined ? {} : { locators: hit.locators }),
          score: hit.score,
          overlayGeneration: hit.overlayGeneration
        };
      }),
      diagnostics: result.diagnostics
    };
  };

  const result = await input.intelligence.completeWithTools({
    system: DERIVED_TEMPLATE_SYSTEM_PROMPT,
    user: templateUserPrompt(input.output),
    firstTool: "retrieve",
    output: {
      name: "semantic_derived_variables",
      description: "Named grounded values and the issued evidence identifiers each value used",
      schema: templateSchema,
      parse: templateDecision
    },
    tools: [
      {
        name: "retrieve",
        description:
          "Search the current Semantic Overlay. Returns exact source spans with application-issued evidence IDs.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1, maxLength: 2000 },
            topK: { type: "integer", minimum: 1, maximum: 20 }
          },
          required: ["query"],
          additionalProperties: false
        },
        execute: retrieve
      }
    ]
  });

  const expected = template.variables.map((variable) => variable.name);
  const actual = result.value.variables.map((variable) => variable.name);
  const exactNames =
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((name) => actual.includes(name));
  const decisions = expected.map((name) =>
    result.value.variables.find((variable) => variable.name === name)
  );
  const groundedDecisions = exactNames
    ? decisions.filter(
        (decision): decision is VariableDecision =>
          decision !== undefined &&
          decision.status === "answered" &&
          decision.value.trim().length > 0 &&
          decision.evidence.length > 0 &&
          new Set(decision.evidence.map((selection) => selection.evidenceId)).size ===
            decision.evidence.length &&
          decision.evidence.every((selection) => issued.has(selection.evidenceId))
      )
    : [];
  const allGrounded = groundedDecisions.length === expected.length;
  const variables: DerivedVariableResolution[] = allGrounded
    ? groundedDecisions.map((decision) => ({
        name: decision.name,
        value: oneParagraph(decision.value),
        evidence: decision.evidence
      }))
    : [];
  const usesByEvidence = new Map<string, string[]>();
  if (allGrounded) {
    for (const selection of groundedDecisions.flatMap((decision) => decision.evidence)) {
      const uses = usesByEvidence.get(selection.evidenceId) ?? [];
      if (!uses.includes(selection.use)) uses.push(selection.use);
      usesByEvidence.set(selection.evidenceId, uses);
    }
  }
  const selections = [...usesByEvidence].map(([evidenceId, uses]) => ({
    evidenceId,
    use: uses.join("; ")
  }));
  const citations = resolveEvidenceSelections(selections, issued);
  const answered = variables.length === template.variables.length && citations.length > 0;
  return {
    status: answered ? "answered" : "insufficient",
    text: answered ? renderDerivedTemplate(template, variables) : DERIVED_OUTPUT_INSUFFICIENT_TEXT,
    queries,
    overlayGenerations,
    evidence: answered ? citations : [],
    variables: answered ? variables : [],
    embeddingUsage,
    intelligenceUsage: result.usage,
    toolCalls: result.toolCalls.length
  };
};

/** One isolated agent attempt. Its evidence registry dies after selected citations are copied. */
export const synthesize = async (input: SynthesisInput): Promise<SynthesisAttempt> => {
  if (input.output.template !== undefined) return synthesizeTemplate(input);
  const issued = new Map<string, SemanticHit>();
  const evidenceByHit = new Map<string, string>();
  const queries: string[] = [];
  const overlayGenerations: number[] = [];
  const embeddingUsage: ProviderUsage[] = [];
  let nextEvidence = 1;

  const retrieve = async (value: unknown) => {
    const asked = queryInput(value, input.defaultTopK);
    if (!queries.includes(asked.query)) queries.push(asked.query);
    const result = await input.query({
      text: asked.query,
      topK: asked.topK,
      ...(input.output.scope === undefined ? {} : { scope: input.output.scope })
    });
    if (!overlayGenerations.includes(result.overlayGeneration)) {
      overlayGenerations.push(result.overlayGeneration);
    }
    embeddingUsage.push(...result.usage);
    return {
      hits: result.hits.map((hit) => {
        const key = hitKey(hit);
        let evidenceId = evidenceByHit.get(key);
        if (evidenceId === undefined) {
          evidenceId = `evidence-${nextEvidence}`;
          nextEvidence += 1;
          evidenceByHit.set(key, evidenceId);
          issued.set(evidenceId, hit);
        }
        return {
          evidenceId,
          source: hit.source,
          span: hit.span,
          ...(hit.locators === undefined ? {} : { locators: hit.locators }),
          score: hit.score,
          overlayGeneration: hit.overlayGeneration
        };
      }),
      diagnostics: result.diagnostics
    };
  };

  const result = await input.intelligence.completeWithTools({
    system: DERIVED_OUTPUT_SYSTEM_PROMPT,
    user: userPrompt(input.output),
    firstTool: "retrieve",
    output: {
      name: "semantic_derived_output",
      description: "A grounded answer and the issued evidence identifiers it used",
      schema: synthesisSchema,
      parse: synthesisDecision
    },
    tools: [
      {
        name: "retrieve",
        description:
          "Search the current Semantic Overlay. Returns exact source spans with application-issued evidence IDs.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1, maxLength: 2000 },
            topK: { type: "integer", minimum: 1, maximum: 20 }
          },
          required: ["query"],
          additionalProperties: false
        },
        execute: retrieve
      }
    ]
  });

  const selectedIds = result.value.evidence.map((selection) => selection.evidenceId);
  const validAnswered =
    result.value.status === "answered" &&
    result.value.response.trim().length > 0 &&
    result.value.evidence.length > 0 &&
    new Set(selectedIds).size === selectedIds.length &&
    selectedIds.every((evidenceId) => issued.has(evidenceId));
  const citations = validAnswered
    ? resolveEvidenceSelections(result.value.evidence, issued)
    : [];
  return {
    status: citations.length === 0 ? "insufficient" : "answered",
    text:
      citations.length === 0
        ? DERIVED_OUTPUT_INSUFFICIENT_TEXT
        : oneParagraph(result.value.response),
    queries,
    overlayGenerations,
    evidence: citations,
    embeddingUsage,
    intelligenceUsage: result.usage,
    toolCalls: result.toolCalls.length
  };
};
