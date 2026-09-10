import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import type { MaterialHit } from "$representation/data/types/semantic/material";
import type { SemanticHit } from "$representation/data/types/semantic/index";
import { createResourceReadingSession } from "$capabilities/derived-output/api/shared/resource-reading";
import { materialDescriptorEvidence } from "$capabilities/derived-output/api/shared/synthesis-evidence";
import {
  materialQueryInput,
  queryInput
} from "$capabilities/derived-output/api/shared/synthesis-parsing";
import type {
  AttemptEnvironment,
  EvidenceDraft,
  SynthesisInput
} from "$capabilities/derived-output/api/shared/synthesis-types";
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";

export const synthesisEnvironment = (input: SynthesisInput): AttemptEnvironment => {
  const issued = new Map<string, EvidenceDraft>();
  const evidenceByKey = new Map<string, string>();
  const queries: string[] = [];
  const overlayGenerations: number[] = [];
  const embeddingUsage: AttemptEnvironment["embeddingUsage"] = [];
  let nextEvidence = 1;
  const issue = (key: string, evidence: EvidenceDraft): string => {
    const found = evidenceByKey.get(key);
    if (found !== undefined) return found;
    const id = `evidence-${nextEvidence++}`;
    evidenceByKey.set(key, id);
    issued.set(id, evidence);
    return id;
  };
  const reading =
    input.reading === undefined
      ? undefined
      : createResourceReadingSession({
          model: input.reading.model,
          projectId: input.output.projectId,
          ...(input.output.scope === undefined ? {} : { scope: input.output.scope }),
          ...(input.reading.selection === undefined
            ? {}
            : { selection: input.reading.selection }),
          issue
        });
  const retrieve: IntelligenceTool = {
    ...describedAgentTool("retrieve"),
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 2000 },
        topK: { type: "integer", minimum: 1, maximum: 20 }
      },
      required: ["query"],
      additionalProperties: false
    },
    execute: async (value) => {
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
        hits: result.hits.map((hit: SemanticHit) => {
          const key = JSON.stringify([
            "text",
            hit.source,
            hit.span.from,
            hit.span.to,
            hit.overlayGeneration
          ]);
          const evidenceId = issue(key, {
            source: hit.source,
            span: hit.span,
            ...(hit.locators === undefined ? {} : { locators: hit.locators }),
            ...(hit.partition === undefined ? {} : { partition: hit.partition }),
            overlayGeneration: hit.overlayGeneration
          });
          return {
            evidenceId,
            source: hit.source,
            span: hit.span,
            ...(hit.locators === undefined ? {} : { locators: hit.locators }),
            ...(hit.partition === undefined ? {} : { partition: hit.partition }),
            score: hit.score,
            overlayGeneration: hit.overlayGeneration
          };
        }),
        diagnostics: result.diagnostics
      };
    }
  };
  const tools = [retrieve, ...(reading?.tools ?? [])];
  const materialReading = input.reading;
  if (materialReading !== undefined && reading !== undefined) {
    tools.splice(1, 0, {
      ...describedAgentTool("retrieve_materials"),
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 2000 },
          kinds: {
            type: "array",
            items: {
              type: "string",
              enum: ["table", "csv", "chart", "image", "code"]
            },
            maxItems: 5
          },
          topK: { type: "integer", minimum: 1, maximum: 20 }
        },
        required: ["query"],
        additionalProperties: false
      },
      execute: async (value) => {
        const asked = materialQueryInput(value, input.defaultTopK);
        if (!queries.includes(asked.query)) queries.push(asked.query);
        const result = await materialReading.queryMaterials({
          text: asked.query,
          topK: asked.topK,
          ...(asked.kinds === undefined ? {} : { kinds: asked.kinds }),
          ...(input.output.scope === undefined ? {} : { scope: input.output.scope })
        });
        if (!overlayGenerations.includes(result.overlayGeneration)) {
          overlayGenerations.push(result.overlayGeneration);
        }
        embeddingUsage.push(...result.usage);
        return {
          hits: result.hits.map((hit: MaterialHit) => {
            const descriptor = materialDescriptorEvidence(hit);
            const evidenceId = issue(
              JSON.stringify([
                "material",
                hit.material.materialId,
                hit.material.revisionKey,
                descriptor.facet,
                descriptor.inputHash,
                hit.overlayGeneration
              ]),
              {
                evidenceKind: "descriptor",
                distance: 2,
                material: hit.material,
                facet: descriptor.facet,
                text: descriptor.text,
                inputHash: descriptor.inputHash,
                ...(descriptor.model === undefined ? {} : { model: descriptor.model }),
                ...(descriptor.promptVersion === undefined
                  ? {}
                  : { promptVersion: descriptor.promptVersion }),
                overlayGeneration: hit.overlayGeneration
              }
            );
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
  }
  return {
    tools,
    issued,
    queries,
    overlayGenerations,
    embeddingUsage,
    firstTool: input.reading?.selection === undefined ? "retrieve" : "read_selection"
  };
};
