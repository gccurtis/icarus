import type { SemanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";
import type { TableRow } from "$model/server/store/index.server";
import { buildRecursiveIndex } from "$representation/data/behavior/semantic/recursive-index";
import type { Id } from "$representation/data/types/core/id";
import type {
  IndexableSemanticObject,
  SemanticIndexLane,
  SemanticIndexNodeDraft
} from "$representation/data/types/semantic/index";
import { semanticIndexConfiguration } from "$capabilities/semantic-overlay/api/shared/configuration";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import type { RebuildSemanticIndexResult } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

export type StagedSemanticIndex = RebuildSemanticIndexResult & {
  commit(): void;
  rollback(): void;
};

/**
 * Persists a complete candidate tree without retiring the queryable predecessor.
 * The caller completes its source publication in the same synchronous turn and
 * then chooses commit or rollback before yielding back to another request.
 */
export const stageSemanticIndex = (
  model: SemanticUnitModel,
  projectId: Id<"projects">,
  overlay: TableRow<"semanticOverlays">,
  objects: readonly IndexableSemanticObject[],
  lane: SemanticIndexLane = "text"
): StagedSemanticIndex => {
  const configuration = semanticIndexConfiguration(model.configuration);
  const build = buildRecursiveIndex(objects, configuration);
  const draftByKey = new Map<string, SemanticIndexNodeDraft>(
    build.nodes.map((node) => [node.key, node])
  );
  const oldIndexes = rowsOf(model.store, "semanticIndexes").filter(
    (row) => row.projectId === projectId && (row.lane ?? "text") === lane
  );
  const oldIndexIds = new Set(oldIndexes.map((index) => index._id));
  const oldNodes = rowsOf(model.store, "semanticIndexNodes").filter((node) =>
    oldIndexIds.has(node.indexId)
  );
  const indexId = model.store.create("semanticIndexes", {
    projectId,
    semanticOverlayId: overlay._id,
    method: "recursiveClustering",
    lane,
    rootNodeIds: [],
    configuration,
    updatedAt: Date.now()
  });
  const createdNodeIds: Id<"semanticIndexNodes">[] = [];
  let settled = false;

  const rollback = (): void => {
    if (settled) return;
    settled = true;
    model.store.removeRows("semanticIndexNodes", [...createdNodeIds].reverse());
    model.store.removeRows("semanticIndexes", [indexId]);
  };

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
    rollback();
    throw error;
  }

  return {
    indexId,
    objectCount: objects.length,
    nodeCount: build.nodes.length,
    rootCount: build.rootKeys.length,
    commit() {
      if (settled) return;
      settled = true;
      model.store.removeRows(
        "semanticIndexNodes",
        oldNodes.map((node) => node._id)
      );
      model.store.removeRows(
        "semanticIndexes",
        oldIndexes.map((index) => index._id)
      );
    },
    rollback
  };
};
