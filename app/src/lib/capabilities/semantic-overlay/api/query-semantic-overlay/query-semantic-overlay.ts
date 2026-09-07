import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { searchRecursiveIndex } from "$representation/data/behavior/semantic/query";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import type { Id } from "$representation/data/types/core/id";
import type { SearchableSemanticObject } from "$representation/data/types/semantic/index";
import { currentOverlay } from "$capabilities/semantic-overlay/api/shared/overlay";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { validateQuerySemanticOverlay } from "$capabilities/semantic-overlay/api/query-semantic-overlay/validate-query-semantic-overlay";
import type { QuerySemanticOverlayResult } from "$capabilities/semantic-overlay/types/query-semantic-overlay";

const sameSpace = (
  left: { provider: string; model: string; dimensions: number },
  right: { provider: string; model: string; dimensions: number }
): boolean =>
  left.provider === right.provider &&
  left.model === right.model &&
  left.dimensions === right.dimensions;

const sourceKey = (source: {
  ref: { kind: string; id: string };
  revision: number;
  encoding: string;
}): string =>
  JSON.stringify([source.ref.kind, source.ref.id, source.revision, source.encoding]);

/** Embeds one query, traverses the current tree, and returns citation-ready values. */
export const querySemanticOverlay = async (
  input: unknown
): Promise<QuerySemanticOverlayResult> => {
  const scope = await requireScope();
  const asked = validateQuerySemanticOverlay(input);

  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const overlay = currentOverlay(model.store, projectId);
  if (!sameSpace(overlay.embedding, model.embedding.space)) {
    throw new Error("The active Semantic Overlay and configured embedding model use different vector spaces");
  }

  const sourceRows = rowsOf(model.store, "semanticSources").filter(
    (row) => row.projectId === projectId
  );
  const sources = new Map(sourceRows.map((source) => [source._id, source]));
  const objects: SearchableSemanticObject[] = rowsOf(model.store, "semanticObjects")
    .filter((row) => row.projectId === projectId)
    .map((object) => {
      const source = sources.get(object.semanticSourceId);
      if (source === undefined) {
        throw new Error(`semantic object '${object._id}' has no active source`);
      }
      return {
        id: object._id,
        vector: object.vector,
        span: object.span,
        source: {
          ref: source.ref,
          revision: source.revision,
          encoding: source.encoding
        }
      };
    });

  const namedSets = new Map(
    rowsOf(model.store, "resourceSets")
      .filter((row) => row.projectId === projectId)
      .map((row) => [row._id, row.set])
  );
  const eligible =
    asked.scope === undefined
      ? objects
      : objects.filter((object) =>
          resourceInScope(object.source.ref, asked.scope!, (id) => namedSets.get(id))
        );

  if (eligible.length === 0) {
    return {
      overlayGeneration: overlay.generation,
      hits: [],
      usage: [],
      diagnostics: {
        eligibleObjects: 0,
        candidateTarget: 0,
        visitedNodes: 0,
        evaluatedObjects: 0,
        exhausted: true
      }
    };
  }

  const index = rowsOf(model.store, "semanticIndexes")
    .filter(
      (row) =>
        row.projectId === projectId &&
        row.semanticOverlayId === overlay._id &&
        row.method === "recursiveClustering" &&
        row.rootNodeIds.length > 0
    )
    .sort((left, right) => right._creationTime - left._creationTime)[0];
  if (index === undefined) throw new Error("The active Semantic Overlay has no recursive index");

  const nodes = rowsOf(model.store, "semanticIndexNodes")
    .filter((row) => row.projectId === projectId && row.indexId === index._id)
    .map((node) => ({
      id: node._id,
      centroidVector: node.centroidVector,
      children: node.children
    }));
  const embedded = await model.embedding.query(asked.text);
  const found = searchRecursiveIndex({
    queryVector: embedded.value,
    rootNodeIds: index.rootNodeIds,
    nodes,
    objects,
    ...(eligible.length === objects.length
      ? {}
      : { eligibleObjectIds: eligible.map((object) => object.id) }),
    topK: asked.topK,
    configuration: index.configuration,
    overlayGeneration: overlay.generation
  });
  const sourceBySnapshot = new Map(sourceRows.map((source) => [sourceKey(source), source]));
  const hits = found.hits.map((hit) => {
    const source = sourceBySnapshot.get(sourceKey(hit.source));
    const locators = source?.locators?.filter(
      (entry) => entry.from < hit.span.to && hit.span.from < entry.to
    );
    return {
      ...hit,
      ...(locators === undefined || locators.length === 0 ? {} : { locators })
    };
  });

  model.observability.logger.info("semanticOverlay.queried", {
    projectId,
    indexId: index._id,
    topK: asked.topK,
    returnedHits: hits.length,
    ...found.diagnostics
  });
  return {
    overlayGeneration: overlay.generation,
    hits,
    usage: [embedded.usage],
    diagnostics: found.diagnostics
  };
};
