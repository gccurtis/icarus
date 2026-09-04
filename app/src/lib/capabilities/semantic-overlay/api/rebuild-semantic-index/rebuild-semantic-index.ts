import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { buildRecursiveIndex } from "$representation/data/behavior/semantic/recursive-index";
import type { Id } from "$representation/data/types/core/id";
import type { SemanticIndexNodeDraft } from "$representation/data/types/semantic/index";
import { semanticIndexConfiguration } from "$capabilities/semantic-overlay/api/shared/configuration";
import { currentOverlay } from "$capabilities/semantic-overlay/api/shared/overlay";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { validateRebuildSemanticIndex } from "$capabilities/semantic-overlay/api/rebuild-semantic-index/validate-rebuild-semantic-index";
import type { RebuildSemanticIndexResult } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

const sameSpace = (
  left: { provider: string; model: string; dimensions: number },
  right: { provider: string; model: string; dimensions: number }
): boolean =>
  left.provider === right.provider &&
  left.model === right.model &&
  left.dimensions === right.dimensions;

/** Replaces the project's derived tree only after its successor is complete. */
export const rebuildSemanticIndex = async (
  input: unknown
): Promise<RebuildSemanticIndexResult> => {
  const scope = await requireScope();
  validateRebuildSemanticIndex(input);

  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const overlay = currentOverlay(model.store, projectId);
  if (!sameSpace(overlay.embedding, model.embedding.space)) {
    throw new Error("The active Semantic Overlay and configured embedding model use different vector spaces");
  }

  const configuration = semanticIndexConfiguration(model.configuration);
  const objects = rowsOf(model.store, "semanticObjects").filter(
    (row) => row.projectId === projectId
  );
  const build = buildRecursiveIndex(
    objects.map((object) => ({ id: object._id, vector: object.vector })),
    configuration
  );
  const draftByKey = new Map<string, SemanticIndexNodeDraft>(
    build.nodes.map((node) => [node.key, node])
  );
  const oldIndexes = rowsOf(model.store, "semanticIndexes").filter(
    (row) => row.projectId === projectId
  );
  const oldIndexIds = new Set(oldIndexes.map((index) => index._id));
  const oldNodes = rowsOf(model.store, "semanticIndexNodes").filter((node) =>
    oldIndexIds.has(node.indexId)
  );

  const updatedAt = Date.now();
  const indexId = model.store.create("semanticIndexes", {
    projectId,
    semanticOverlayId: overlay._id,
    method: "recursiveClustering",
    rootNodeIds: [],
    configuration,
    updatedAt
  });
  const createdNodeIds: Id<"semanticIndexNodes">[] = [];

  const persist = (
    key: string,
    parentNodeId?: Id<"semanticIndexNodes">
  ): Id<"semanticIndexNodes"> => {
    const draft = draftByKey.get(key);
    if (draft === undefined) throw new Error(`semantic index draft '${key}' does not exist`);
    const children =
      draft.children.kind === "objects"
        ? draft.children
        : { kind: "nodes" as const, ids: [] as Id<"semanticIndexNodes">[] };
    const nodeId = model.store.create("semanticIndexNodes", {
      projectId,
      indexId,
      ...(parentNodeId ? { parentNodeId } : {}),
      centroidVector: draft.centroidVector,
      children
    });
    createdNodeIds.push(nodeId);

    if (draft.children.kind === "nodes") {
      const ids = draft.children.keys.map((child) => persist(child, nodeId));
      model.store.update(`semanticIndexNodes.${nodeId}.children`, { kind: "nodes", ids });
    }
    return nodeId;
  };

  try {
    const rootNodeIds = build.rootKeys.map((key) => persist(key));
    model.store.update(`semanticIndexes.${indexId}.rootNodeIds`, rootNodeIds);
  } catch (error) {
    for (const nodeId of createdNodeIds.reverse()) {
      try {
        model.store.remove(`semanticIndexNodes.${nodeId}`);
      } catch {
        // Preserve the construction failure; cleanup is best effort in the JSON store.
      }
    }
    try {
      model.store.remove(`semanticIndexes.${indexId}`);
    } catch {
      // Preserve the construction failure.
    }
    throw error;
  }

  // The old tree stays queryable until the replacement has all of its roots.
  oldNodes.forEach((node) => model.store.remove(`semanticIndexNodes.${node._id}`));
  oldIndexes.forEach((index) => model.store.remove(`semanticIndexes.${index._id}`));
  model.observability.logger.info("semanticOverlay.index.rebuilt", {
    projectId,
    indexId,
    objectCount: objects.length,
    nodeCount: build.nodes.length,
    rootCount: build.rootKeys.length
  });

  return {
    indexId,
    objectCount: objects.length,
    nodeCount: build.nodes.length,
    rootCount: build.rootKeys.length
  };
};
