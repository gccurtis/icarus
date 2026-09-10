import type { ServerModel } from "$runtime/server/start.server";
import type { TableRow } from "$model/server/store/index.server";
import { searchRecursiveIndex } from "$representation/data/behavior/semantic/query";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import { admittedReusableResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SearchableSemanticObject } from "$representation/data/types/semantic/index";
import { currentOverlay } from "$capabilities/semantic-overlay/api/shared/overlay";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { semanticSourceIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
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
  ref: ResourceRef;
  revision: number;
  contentHash?: string;
  encoding: string;
}): string =>
  JSON.stringify([
    source.ref.kind,
    source.ref.id,
    source.revision,
    source.contentHash ?? null,
    source.encoding
  ]);

type TextObjectRow = Extract<TableRow<"semanticObjects">, { lane: "text" }>;

/** Embeds one query, traverses the current tree, and returns citation-ready values. */
export const querySemanticOverlayForModel = async (
  model: ServerModel,
  projectId: Id<"projects">,
  input: unknown,
  signal?: AbortSignal
): Promise<QuerySemanticOverlayResult> => {
  const asked = validateQuerySemanticOverlay(input);
  signal?.throwIfAborted();
  const overlay = currentOverlay(model.store, projectId);
  if (!sameSpace(overlay.embedding, model.embedding.space)) {
    throw new Error("The active Semantic Overlay and configured embedding model use different vector spaces");
  }

  const sourceRows = rowsOf(model.store, "semanticSources").filter(
    (row) => row.projectId === projectId
  );
  const sources = new Map(sourceRows.map((source) => [source._id, source]));
  const activeSourceIds = new Set(sourceRows.flatMap((source) =>
    semanticSourceIsCurrent(model.store, projectId, source)
      ? [source._id]
      : []
  ));
  const activeObjectIds = new Set<Id<"semanticObjects">>();
  const objects: SearchableSemanticObject[] = rowsOf(model.store, "semanticObjects")
    .flatMap((row): TextObjectRow[] =>
      row.projectId === projectId && row.lane === "text" && "semanticSourceId" in row && "span" in row
        ? [row as TextObjectRow]
        : []
    )
    .flatMap((object): SearchableSemanticObject[] => {
      const source = sources.get(object.semanticSourceId);
      if (source === undefined) {
        throw new Error(`semantic object '${object._id}' has no source`);
      }
      if (activeSourceIds.has(source._id)) activeObjectIds.add(object._id);
      return [{
        id: object._id,
        vector: object.vector,
        span: object.span,
        source: {
          ref: source.ref,
          revision: source.revision,
          ...(source.contentHash === undefined ? {} : { contentHash: source.contentHash }),
          encoding: source.encoding
        },
        ...(source.hardBoundaries === undefined || source.hardBoundaries.length === 0
          ? {}
          : {
              partition: `partition:${source.hardBoundaries.filter((boundary) => boundary <= object.span.from).length}`
            })
      }];
    });

  const namedSets = admittedReusableResourceSets(
    rowsOf(model.store, "resourceSets"),
    projectId
  );
  // Keep every indexed object resolvable for tree integrity, but make stale
  // resource revisions ineligible before traversal.
  const eligible = objects.filter((object) => {
    if (!activeObjectIds.has(object.id)) return false;
    return asked.scope === undefined ||
      resourceInScope(object.source.ref, asked.scope, (id) => namedSets.get(id)?.set);
  });

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
        row.lane === "text" &&
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
  const embedded = await model.embedding.query(asked.text, signal);
  signal?.throwIfAborted();
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
