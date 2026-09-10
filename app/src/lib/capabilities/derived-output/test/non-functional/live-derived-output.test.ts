import { expect, test } from "vitest";

import { createConfiguration } from "$model/server/configuration/index.server";
import { createEmbedding } from "$model/server/embedding/index.server";
import { createIntelligence } from "$model/server/intelligence/index.server";
import { buildRecursiveIndex } from "$representation/data/behavior/semantic/recursive-index";
import { searchRecursiveIndex } from "$representation/data/behavior/semantic/query";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import { synthesize } from "$capabilities/derived-output/api/shared/synthesis";

const live = process.env.ICARUS_LIVE_DERIVED_OUTPUT === "1";

test.runIf(live)("real Jina retrieval grounds a real OpenRouter tool loop", async () => {
  const configuration = await createConfiguration();
  const embedding = createEmbedding(configuration);
  const intelligence = createIntelligence(configuration);
  const texts = [
    "Project Aster's launch review is Tuesday at 14:00 UTC. Release captain Mira Chen will lead it.",
    "Project Birch keeps its customer interviews in the research archive.",
    "Project Aster's rollback rehearsal happens Friday and is led by Tomas Reed."
  ];
  const passages = await embedding.windowedPassages(texts);
  const objects = passages.value.map((vector, index) => ({
    id: `semanticObjects:${index + 1}` as Id<"semanticObjects">,
    vector,
    source: {
      ref: {
        kind: "document" as const,
        id: asId<"documents">(`documents:brief-${index + 1}`)
      },
      revision: 1,
      encoding: "utf-16" as const
    },
    span: { from: 0, to: texts[index].length, text: texts[index] }
  }));
  const indexConfiguration = {
    branchFactor: 2,
    leafSize: 1,
    maxIterations: 12,
    convergenceTolerance: 0.000001,
    candidateMultiplier: 3
  };
  const draft = buildRecursiveIndex(objects, indexConfiguration);
  const ids = new Map(
    draft.nodes.map((node, index) => [
      node.key,
      `semanticIndexNodes:${index + 1}` as Id<"semanticIndexNodes">
    ])
  );
  const nodes = draft.nodes.map((node) => ({
    id: ids.get(node.key)!,
    centroidVector: node.centroidVector,
    children:
      node.children.kind === "objects"
        ? node.children
        : { kind: "nodes" as const, ids: node.children.keys.map((key) => ids.get(key)!) }
  }));
  const output: DerivedOutput = {
    _id: "derivedOutputs:live" as Id<"derivedOutputs">,
    _creationTime: Date.now(),
    projectId: "projects:live" as Id<"projects">,
    prompt: "When is Project Aster's launch review, and who leads it?",
    definitionRevision: 1,
    queries: [],
    evidence: [],
    state: "idle",
    createdBy: { kind: "system" },
    updatedAt: Date.now()
  };

  const result = await synthesize({
    output,
    intelligence,
    defaultTopK: 3,
    query: async (query) => {
      const embedded = await embedding.query(query.text);
      const found = searchRecursiveIndex({
        queryVector: embedded.value,
        rootNodeIds: draft.rootKeys.map((key) => ids.get(key)!),
        nodes,
        objects,
        topK: query.topK,
        configuration: indexConfiguration,
        overlayGeneration: 11
      });
      return {
        overlayGeneration: 11,
        hits: found.hits,
        usage: [embedded.usage],
        diagnostics: found.diagnostics
      };
    }
  });

  expect(result.queries.length).toBeGreaterThan(0);
  expect(result.status).toBe("answered");
  expect(result.toolCalls).toBeGreaterThanOrEqual(1);
  expect(result.evidence.some((citation) => "span" in citation && citation.span.text.includes("Mira Chen"))).toBe(true);
  expect(result.evidence.every((citation) => citation.selections.length > 0)).toBe(true);
  expect(result.text).toMatch(/Tuesday/i);
  expect(result.text).toMatch(/14:00 UTC/i);
  expect(result.text).toMatch(/Mira Chen/i);
}, 120_000);
