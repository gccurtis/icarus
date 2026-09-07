import type { ServerModel } from "$runtime/server/start.server";
import type { IntelligenceModel, IntelligenceTool, IntelligenceUsage } from "$model/server/intelligence/index.server";
import { coalesceSemanticCitations } from "$representation/data/behavior/semantic/citation";
import { renderDerivedTemplate } from "$representation/data/behavior/semantic/derived-template";
import type {
  DerivedOutput,
  DerivedOutputSelection,
  DerivedVariableResolution,
  MaterialDescriptorCitation,
  MaterialNativeCitation,
  SemanticCitation,
  SemanticTextCitation
} from "$representation/data/types/semantic/derived-output";
import type { MaterialHit } from "$representation/data/types/semantic/material";
import type { SemanticHit } from "$representation/data/types/semantic/index";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import type {
  QuerySemanticMaterialsInput,
  QuerySemanticMaterialsResult,
  QuerySemanticOverlayInput,
  QuerySemanticOverlayResult
} from "$capabilities/semantic-overlay/index.remote";
import { createResourceReadingSession } from "$capabilities/derived-output/api/shared/resource-reading";
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

type ReadingInput = {
  readonly model: ServerModel;
  readonly selection?: DerivedOutputSelection;
  queryMaterials(input: QuerySemanticMaterialsInput): Promise<QuerySemanticMaterialsResult>;
};

type SynthesisInput = {
  readonly output: DerivedOutput;
  readonly intelligence: IntelligenceModel;
  readonly defaultTopK: number;
  readonly reading?: ReadingInput;
  query(input: QuerySemanticOverlayInput): Promise<QuerySemanticOverlayResult>;
};

type EvidenceDraft =
  | Omit<SemanticTextCitation, "selections">
  | Omit<MaterialDescriptorCitation, "selections">
  | Omit<MaterialNativeCitation, "selections">;

type EvidenceSelection = { evidenceId: string; use: string };

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const queryInput = (value: unknown, defaultTopK: number): { query: string; topK: number } => {
  const candidate = record(value, "retrieve input must be an object");
  if (typeof candidate.query !== "string" || !candidate.query.trim()) throw new Error("retrieve query must not be blank");
  if (candidate.query.length > 2_000) throw new Error("retrieve query is too long");
  const topK = candidate.topK ?? defaultTopK;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 20) {
    throw new Error("retrieve topK must be an integer from 1 through 20");
  }
  return { query: candidate.query.trim(), topK: topK as number };
};

const materialQueryInput = (value: unknown, defaultTopK: number) => {
  const candidate = queryInput(value, defaultTopK);
  const raw = record(value, "retrieve_materials input must be an object");
  const supported = new Set(["table", "csv", "chart", "image", "code"]);
  const kinds = raw.kinds === undefined
    ? undefined
    : Array.isArray(raw.kinds) && raw.kinds.every((kind) => supported.has(String(kind)))
      ? [...new Set(raw.kinds as Array<"table" | "csv" | "chart" | "image" | "code">)]
      : (() => { throw new Error("retrieve_materials kinds are invalid"); })();
  return { ...candidate, ...(kinds === undefined ? {} : { kinds }) };
};

/**
 * Discovery is allowed to match a native visual vector, but a vector match is
 * orientation rather than a factual statement.  Issue descriptor evidence
 * from the exact facet text that was actually matched; if the only match was
 * non-textual, fall back to the deterministic profile facet and its own hash.
 */
export const materialDescriptorEvidence = (hit: MaterialHit): {
  facet: MaterialDescriptorCitation["facet"];
  inputHash: string;
  text: string;
  model?: string;
  promptVersion?: string;
} => {
  const textualMatch = hit.matched.find(
    (candidate): candidate is typeof candidate & { text: string } =>
      typeof candidate.text === "string" && candidate.text.trim().length > 0
  );
  if (textualMatch !== undefined) return {
    facet: textualMatch.facet,
    inputHash: textualMatch.inputHash,
    text: textualMatch.text,
    ...(textualMatch.facet === "generated" && hit.description?.provenance === "generated"
      ? { model: hit.description.model, promptVersion: hit.description.promptVersion }
      : {})
  };
  return {
    facet: "profile",
    inputHash: hit.profileFacet.inputHash,
    text: hit.profileFacet.text
  };
};

export const resolveEvidenceSelections = (
  selections: readonly EvidenceSelection[],
  issued: ReadonlyMap<string, EvidenceDraft>
): SemanticCitation[] => coalesceSemanticCitations(selections.map((selection) => {
  const evidence = issued.get(selection.evidenceId);
  if (evidence === undefined) throw new Error("selected evidence disappeared from its attempt");
  return { ...evidence, selections: [selection] } as SemanticCitation;
}));

type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: EvidenceSelection[];
};

const evidenceSelections = (value: unknown, label: string): EvidenceSelection[] => {
  if (!Array.isArray(value) || value.length > 200) throw new Error(`${label} evidence must be an array of at most 200 items`);
  return value.map((entry) => {
    const selection = record(entry, `${label} evidence selection must be an object`);
    if (typeof selection.evidenceId !== "string" || !selection.evidenceId.trim()) throw new Error(`${label} evidence id must not be blank`);
    if (typeof selection.use !== "string" || !selection.use.trim()) throw new Error(`${label} evidence use must not be blank`);
    return { evidenceId: selection.evidenceId.trim(), use: selection.use.trim() };
  });
};

const synthesisDecision = (value: unknown): SynthesisDecision => {
  const candidate = record(value, "synthesis decision must be an object");
  if (candidate.status !== "answered" && candidate.status !== "insufficient") throw new Error("synthesis decision has an invalid status");
  if (typeof candidate.response !== "string") throw new Error("synthesis decision response must be text");
  return { status: candidate.status, response: candidate.response, evidence: evidenceSelections(candidate.evidence, "synthesis") };
};

const evidenceSchema = {
  type: "array",
  maxItems: 200,
  items: {
    type: "object",
    properties: { evidenceId: { type: "string" }, use: { type: "string" } },
    required: ["evidenceId", "use"],
    additionalProperties: false
  }
} as const;

const synthesisSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "insufficient"] },
    response: { type: "string" },
    evidence: evidenceSchema
  },
  required: ["status", "response", "evidence"],
  additionalProperties: false
} as const;

type VariableDecision = {
  name: string;
  status: "answered" | "insufficient";
  value: string;
  evidence: EvidenceSelection[];
};

const variableDecision = (value: unknown): VariableDecision => {
  const candidate = record(value, "derived variable decision must be an object");
  if (typeof candidate.name !== "string" || !candidate.name.trim()) throw new Error("derived variable decision name must not be blank");
  if (candidate.status !== "answered" && candidate.status !== "insufficient") throw new Error("derived variable decision has an invalid status");
  if (typeof candidate.value !== "string") throw new Error("derived variable decision value must be text");
  return {
    name: candidate.name.trim(),
    status: candidate.status,
    value: candidate.value,
    evidence: evidenceSelections(candidate.evidence, "derived variable")
  };
};

const templateDecision = (value: unknown): { variables: VariableDecision[] } => {
  const candidate = record(value, "templated synthesis decision must be an object");
  if (!Array.isArray(candidate.variables) || candidate.variables.length > 32) throw new Error("templated synthesis variables must be an array of at most 32 items");
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
          evidence: evidenceSchema
        },
        required: ["name", "status", "value", "evidence"],
        additionalProperties: false
      }
    }
  },
  required: ["variables"],
  additionalProperties: false
} as const;

const oneParagraph = (text: string): string => text.replace(/\s+/g, " ").trim();
const previousResponse = (output: DerivedOutput): string | undefined =>
  output.lastResponse?.type === "text" ? output.lastResponse.display : undefined;

const userPrompt = (output: DerivedOutput): string => [
  `Task: ${output.prompt}`,
  output.origin === undefined ? "No originating resource was supplied." : `Originating resource for navigation only: ${output.origin.kind}:${output.origin.id}`,
  previousResponse(output) === undefined
    ? "There is no previous response."
    : `Previous response for stylistic continuity only (never factual evidence): ${previousResponse(output)}`
].join("\n\n");

const templateUserPrompt = (output: DerivedOutput): string => {
  if (output.template === undefined) throw new Error("A templated synthesis requires a template");
  return [
    "Variables to resolve:",
    ...output.template.variables.map((variable) => `- ${variable.name}: ${variable.prompt}`),
    `Output template (structure only): ${output.template.output}`,
    output.template.exampleResponse === undefined
      ? "There is no example response."
      : `Example response for format and style only (never factual evidence): ${output.template.exampleResponse}`,
    previousResponse(output) === undefined
      ? "There is no previous response."
      : `Previous response for stylistic continuity only (never factual evidence): ${previousResponse(output)}`
  ].join("\n\n");
};

type AttemptEnvironment = {
  tools: IntelligenceTool[];
  issued: Map<string, EvidenceDraft>;
  queries: string[];
  overlayGenerations: number[];
  embeddingUsage: ProviderUsage[];
  firstTool: string;
};

const environment = (input: SynthesisInput): AttemptEnvironment => {
  const issued = new Map<string, EvidenceDraft>();
  const evidenceByKey = new Map<string, string>();
  const queries: string[] = [];
  const overlayGenerations: number[] = [];
  const embeddingUsage: ProviderUsage[] = [];
  let nextEvidence = 1;
  const issue = (key: string, evidence: EvidenceDraft): string => {
    const found = evidenceByKey.get(key);
    if (found !== undefined) return found;
    const id = `evidence-${nextEvidence++}`;
    evidenceByKey.set(key, id);
    issued.set(id, evidence);
    return id;
  };
  const reading = input.reading === undefined ? undefined : createResourceReadingSession({
    model: input.reading.model,
    projectId: input.output.projectId,
    ...(input.output.scope === undefined ? {} : { scope: input.output.scope }),
    ...(input.reading.selection === undefined ? {} : { selection: input.reading.selection }),
    issue
  });
  const retrieve: IntelligenceTool = {
    name: "retrieve",
    description: "Search only exact authored text in the current Semantic Overlay. Returns consolidated spans with evidence IDs.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 2000 }, topK: { type: "integer", minimum: 1, maximum: 20 } },
      required: ["query"], additionalProperties: false
    },
    execute: async (value) => {
      const asked = queryInput(value, input.defaultTopK);
      if (!queries.includes(asked.query)) queries.push(asked.query);
      const result = await input.query({ text: asked.query, topK: asked.topK, ...(input.output.scope === undefined ? {} : { scope: input.output.scope }) });
      if (!overlayGenerations.includes(result.overlayGeneration)) overlayGenerations.push(result.overlayGeneration);
      embeddingUsage.push(...result.usage);
      return {
        hits: result.hits.map((hit: SemanticHit) => {
          const key = JSON.stringify(["text", hit.source, hit.span.from, hit.span.to, hit.overlayGeneration]);
          const evidenceId = issue(key, {
            source: hit.source,
            span: hit.span,
            ...(hit.locators === undefined ? {} : { locators: hit.locators }),
            ...(hit.partition === undefined ? {} : { partition: hit.partition }),
            overlayGeneration: hit.overlayGeneration
          });
          return { evidenceId, source: hit.source, span: hit.span, ...(hit.locators === undefined ? {} : { locators: hit.locators }), ...(hit.partition === undefined ? {} : { partition: hit.partition }), score: hit.score, overlayGeneration: hit.overlayGeneration };
        }),
        diagnostics: result.diagnostics
      };
    }
  };
  const tools = [retrieve, ...(reading?.tools ?? [])];
  if (input.reading !== undefined && reading !== undefined) tools.splice(1, 0, {
    name: "retrieve_materials",
    description: "Search interpreted material facets for tables, CSV, charts, images, and code. Use native read_* tools for exact claims.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 2000 },
        kinds: { type: "array", items: { type: "string", enum: ["table", "csv", "chart", "image", "code"] }, maxItems: 5 },
        topK: { type: "integer", minimum: 1, maximum: 20 }
      },
      required: ["query"], additionalProperties: false
    },
    execute: async (value) => {
      const asked = materialQueryInput(value, input.defaultTopK);
      if (!queries.includes(asked.query)) queries.push(asked.query);
      const result = await input.reading!.queryMaterials({
        text: asked.query,
        topK: asked.topK,
        ...(asked.kinds === undefined ? {} : { kinds: asked.kinds }),
        ...(input.output.scope === undefined ? {} : { scope: input.output.scope })
      });
      if (!overlayGenerations.includes(result.overlayGeneration)) overlayGenerations.push(result.overlayGeneration);
      embeddingUsage.push(...result.usage);
      return {
        hits: result.hits.map((hit: MaterialHit) => {
          const descriptor = materialDescriptorEvidence(hit);
          const evidenceId = issue(JSON.stringify(["material", hit.material.materialId, hit.material.revisionKey, descriptor.facet, descriptor.inputHash, hit.overlayGeneration]), {
            evidenceKind: "descriptor",
            distance: 2,
            material: hit.material,
            facet: descriptor.facet,
            text: descriptor.text,
            inputHash: descriptor.inputHash,
            ...(descriptor.model === undefined ? {} : { model: descriptor.model }),
            ...(descriptor.promptVersion === undefined ? {} : { promptVersion: descriptor.promptVersion }),
            overlayGeneration: hit.overlayGeneration
          });
          return {
            evidenceId,
            materialHandle: reading.rememberMaterial(hit.material),
            kind: hit.material.kind,
            name: hit.material.name,
            profile: hit.profile,
            description: hit.description,
            matchedFacets: hit.matchedFacets,
            source: hit.material.source,
            placement: hit.material.placement,
            score: hit.score
          };
        }),
        diagnostics: result.diagnostics
      };
    }
  });
  return {
    tools,
    issued,
    queries,
    overlayGenerations,
    embeddingUsage,
    firstTool: input.reading?.selection === undefined ? "retrieve" : "read_selection"
  };
};

const validSelections = (selections: readonly EvidenceSelection[], issued: ReadonlyMap<string, EvidenceDraft>): boolean =>
  selections.length > 0 &&
  new Set(selections.map((selection) => selection.evidenceId)).size === selections.length &&
  selections.every((selection) => issued.has(selection.evidenceId));

const synthesizeTemplate = async (input: SynthesisInput): Promise<SynthesisAttempt> => {
  const template = input.output.template;
  if (template === undefined) throw new Error("A templated synthesis requires a template");
  const attempt = environment(input);
  const result = await input.intelligence.completeWithTools({
    system: DERIVED_TEMPLATE_SYSTEM_PROMPT,
    user: templateUserPrompt(input.output),
    firstTool: attempt.firstTool,
    output: { name: "semantic_derived_variables", description: "Named grounded values and issued evidence identifiers", schema: templateSchema, parse: templateDecision },
    tools: attempt.tools
  });
  const expected = template.variables.map((variable) => variable.name);
  const actual = result.value.variables.map((variable) => variable.name);
  const exactNames = actual.length === expected.length && new Set(actual).size === actual.length && expected.every((name) => actual.includes(name));
  const grounded = exactNames ? expected.map((name) => result.value.variables.find((variable) => variable.name === name)).filter((decision): decision is VariableDecision =>
    decision !== undefined && decision.status === "answered" && decision.value.trim().length > 0 && validSelections(decision.evidence, attempt.issued)
  ) : [];
  const allGrounded = grounded.length === expected.length;
  const variables: DerivedVariableResolution[] = allGrounded ? grounded.map((decision) => ({ name: decision.name, value: oneParagraph(decision.value), evidence: decision.evidence })) : [];
  const uses = new Map<string, string[]>();
  if (allGrounded) for (const selection of grounded.flatMap((decision) => decision.evidence)) {
    const held = uses.get(selection.evidenceId) ?? [];
    if (!held.includes(selection.use)) held.push(selection.use);
    uses.set(selection.evidenceId, held);
  }
  const citations = resolveEvidenceSelections([...uses].map(([evidenceId, values]) => ({ evidenceId, use: values.join("; ") })), attempt.issued);
  const answered = allGrounded && citations.length > 0;
  return {
    status: answered ? "answered" : "insufficient",
    text: answered ? renderDerivedTemplate(template, variables) : DERIVED_OUTPUT_INSUFFICIENT_TEXT,
    queries: attempt.queries,
    overlayGenerations: attempt.overlayGenerations,
    evidence: answered ? citations : [],
    variables: answered ? variables : [],
    embeddingUsage: attempt.embeddingUsage,
    intelligenceUsage: result.usage,
    toolCalls: result.toolCalls.length
  };
};

export const synthesize = async (input: SynthesisInput): Promise<SynthesisAttempt> => {
  if (input.output.template !== undefined) return synthesizeTemplate(input);
  const attempt = environment(input);
  const result = await input.intelligence.completeWithTools({
    system: DERIVED_OUTPUT_SYSTEM_PROMPT,
    user: userPrompt(input.output),
    firstTool: attempt.firstTool,
    output: { name: "semantic_derived_output", description: "A grounded answer and issued evidence identifiers", schema: synthesisSchema, parse: synthesisDecision },
    tools: attempt.tools
  });
  const valid = result.value.status === "answered" && result.value.response.trim().length > 0 && validSelections(result.value.evidence, attempt.issued);
  const citations = valid ? resolveEvidenceSelections(result.value.evidence, attempt.issued) : [];
  return {
    status: citations.length === 0 ? "insufficient" : "answered",
    text: citations.length === 0 ? DERIVED_OUTPUT_INSUFFICIENT_TEXT : oneParagraph(result.value.response),
    queries: attempt.queries,
    overlayGenerations: attempt.overlayGenerations,
    evidence: citations,
    embeddingUsage: attempt.embeddingUsage,
    intelligenceUsage: result.usage,
    toolCalls: result.toolCalls.length
  };
};
