import { expect, test } from "vitest";
import { createConfiguration } from "$model/server/configuration/index.server";
import { createEmbedding } from "$model/server/embedding/constructor";
import { buildRecursiveIndex } from "$representation/data/behavior/semantic/recursive-index";
import { searchRecursiveIndex } from "$representation/data/behavior/semantic/query";
import type { Id } from "$representation/data/types/core/id";

const live = process.env.ICARUS_LIVE_JINA === "1";
const dot = (left: readonly number[], right: readonly number[]): number =>
  left.reduce((sum, value, index) => sum + value * right[index], 0);

test.runIf(live)("configured Jina key serves all three Semantic Overlay embedding modes", async () => {
  const configuration = await createConfiguration();
  const embedding = createEmbedding(configuration);

  const passages = await embedding.passages([
    "A coupon is subtracted before sales tax is calculated.",
    "A heron stands beside a quiet lake at sunrise."
  ]);
  const query = await embedding.query("Where is a discount applied before tax?");
  const tokens = await embedding.tokenField("Cats climb. Dogs fetch.");

  expect(passages.value).toHaveLength(2);
  expect(passages.value.every((vector) => vector.length === embedding.space.dimensions)).toBe(true);
  expect(query.value).toHaveLength(embedding.space.dimensions);
  expect(dot(query.value, passages.value[0])).toBeGreaterThan(dot(query.value, passages.value[1]));
  expect(tokens.value.labels.length).toBeGreaterThan(0);
  expect(tokens.value.vectors).toHaveLength(tokens.value.labels.length);
  expect(tokens.value.vectors.every((vector) => vector.length === 128)).toBe(true);
  expect(passages.usage.inputTokens).toBeGreaterThan(0);
  expect(query.usage.inputTokens).toBeGreaterThan(0);
  expect(tokens.usage.inputTokens).toBeGreaterThan(0);

  const objects = passages.value.map((vector, index) => {
    const text = index === 0
      ? "A coupon is subtracted before sales tax is calculated."
      : "A heron stands beside a quiet lake at sunrise.";
    return {
      id: `semanticObjects:${index + 1}` as Id<"semanticObjects">,
      vector,
      source: {
        ref: { kind: "document", id: `documents:${index + 1}` },
        revision: 1,
        encoding: "utf-16" as const
      },
      span: { from: 0, to: text.length, text }
    };
  });
  const indexConfiguration = {
    branchFactor: 2,
    leafSize: 1,
    maxIterations: 8,
    convergenceTolerance: 0.000001,
    candidateMultiplier: 1
  };
  const draft = buildRecursiveIndex(objects, indexConfiguration);
  const ids = new Map(
    draft.nodes.map((node, index) => [
      node.key,
      `semanticIndexNodes:${index + 1}` as Id<"semanticIndexNodes">
    ])
  );
  const found = searchRecursiveIndex({
    queryVector: query.value,
    rootNodeIds: draft.rootKeys.map((key) => ids.get(key)!),
    nodes: draft.nodes.map((node) => ({
      id: ids.get(node.key)!,
      centroidVector: node.centroidVector,
      children: node.children.kind === "objects"
        ? node.children
        : { kind: "nodes", ids: node.children.keys.map((key) => ids.get(key)!) }
    })),
    objects,
    topK: 1,
    configuration: indexConfiguration,
    overlayGeneration: 1
  });
  expect(found.hits[0].source.ref.id).toBe("documents:1");
});
