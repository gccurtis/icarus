import type { ServerModel } from "$runtime/server/start.server";
import type { TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { EmbeddingSpace } from "$representation/data/types/semantic/overlay";
import type { TranslationResult } from "$representation/data/types/semantic/translation";
import { stageSemanticIndex } from "$capabilities/semantic-overlay/api/shared/index-publication";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import type { RebuildSemanticIndexResult } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

type TextObjectRow = Extract<TableRow<"semanticObjects">, { lane: "text" }>;

type PublicationResult =
  | {
      readonly outcome: "current" | "superseded";
      readonly overlayGeneration: number;
      readonly objectCount: number;
    }
  | {
      readonly outcome: "published";
      readonly overlayGeneration: number;
      readonly objectCount: number;
      readonly index: RebuildSemanticIndexResult;
    };

const sameSpace = (left: EmbeddingSpace, right: EmbeddingSpace): boolean =>
  left.provider === right.provider &&
  left.model === right.model &&
  left.dimensions === right.dimensions;

export const ensureSemanticOverlay = (
  model: ServerModel,
  projectId: Id<"projects">
): TableRow<"semanticOverlays"> => {
  const found = rowsOf(model.store, "semanticOverlays")
    .filter((row) => row.projectId === projectId)
    .sort(
      (left, right) =>
        right.generation - left.generation || right._creationTime - left._creationTime
    )[0];
  if (found !== undefined) {
    if (!sameSpace(found.embedding, model.embedding.space)) {
      throw new Error(
        "The active Semantic Overlay and configured embedding model use different vector spaces"
      );
    }
    return found;
  }

  const id = model.store.create("semanticOverlays", {
    projectId,
    generation: 0,
    embedding: model.embedding.space,
    updatedAt: Date.now()
  });
  const created = rowsOf(model.store, "semanticOverlays").find((row) => row._id === id);
  if (created === undefined) throw new Error("Semantic Overlay was not readable after creation");
  return created;
};

/**
 * Publishes replacement source objects and their replacement index without an
 * asynchronous gap. Older citation values are archived before active rows retire.
 */
export const publishSemanticTranslation = (
  model: ServerModel,
  projectId: Id<"projects">,
  translation: TranslationResult,
  force = false
): PublicationResult => {
  const overlay = ensureSemanticOverlay(model, projectId);
  const matches = rowsOf(model.store, "semanticSources").filter(
    (row) => row.projectId === projectId && sameResourceRef(row.ref, translation.source.ref)
  );
  if (matches.length > 1) {
    throw new Error("A resource has more than one active semantic source");
  }
  const previous = matches[0];
  const previousObjects: TextObjectRow[] =
    previous === undefined
      ? []
      : rowsOf(model.store, "semanticObjects").flatMap((row): TextObjectRow[] =>
          row.projectId === projectId &&
          (row.lane ?? "text") === "text" &&
          "semanticSourceId" in row &&
          row.semanticSourceId === previous._id
            ? [row as TextObjectRow]
            : []
        );
  if (previous !== undefined && previous.revision > translation.source.revision) {
    return {
      outcome: "superseded",
      overlayGeneration: overlay.generation,
      objectCount: previousObjects.length
    };
  }
  if (
    !force &&
    previous !== undefined &&
    previous.revision === translation.source.revision &&
    previous.contentHash === translation.source.contentHash
  ) {
    return {
      outcome: "current",
      overlayGeneration: overlay.generation,
      objectCount: previousObjects.length
    };
  }

  const at = Date.now();
  const sourceId = model.store.create("semanticSources", {
    projectId,
    ref: translation.source.ref,
    revision: translation.source.revision,
    ...(translation.source.contentHash === undefined
      ? {}
      : { contentHash: translation.source.contentHash }),
    encoding: translation.source.encoding,
    ...(translation.source.locators === undefined
      ? {}
      : { locators: translation.source.locators }),
    ...(translation.source.hardBoundaries === undefined
      ? {}
      : { hardBoundaries: translation.source.hardBoundaries }),
    updatedAt: at
  });
  const objectIds = model.store.createMany(
    "semanticObjects",
    translation.objects.map((object) => ({
      projectId,
      semanticSourceId: sourceId,
      lane: "text",
      span: object.span,
      vector: object.vector
    }))
  );
  const previousObjectIds = new Set(previousObjects.map((object) => object._id));
  const candidateObjects = rowsOf(model.store, "semanticObjects")
    .filter(
      (row) =>
        row.projectId === projectId &&
        (row.lane ?? "text") === "text" &&
        !previousObjectIds.has(row._id)
    )
    .map((row) => ({ id: row._id, vector: row.vector }));

  let staged;
  try {
    staged = stageSemanticIndex(model, projectId, overlay, candidateObjects, "text");
  } catch (error) {
    model.store.removeRows("semanticObjects", objectIds);
    model.store.removeRows("semanticSources", [sourceId]);
    throw error;
  }

  const generation = overlay.generation + 1;
  if (previous !== undefined) {
    model.store.createMany(
      "semanticObjectHistory",
      previousObjects.map((object) => ({
        projectId,
        retiredGeneration: generation,
        object: {
          lane: "text",
          source: {
            ref: previous.ref,
            revision: previous.revision,
            ...(previous.contentHash === undefined ? {} : { contentHash: previous.contentHash }),
            encoding: previous.encoding
          },
          span: object.span,
          vector: object.vector
        },
        retiredAt: at
      }))
    );
    model.store.removeRows(
      "semanticObjects",
      previousObjects.map((object) => object._id)
    );
    model.store.removeRows("semanticSources", [previous._id]);
  }
  model.store.update(`semanticOverlays.${overlay._id}.generation`, generation);
  model.store.update(`semanticOverlays.${overlay._id}.updatedAt`, at);
  staged.commit();

  return {
    outcome: "published",
    overlayGeneration: generation,
    objectCount: translation.objects.length,
    index: {
      indexId: staged.indexId,
      objectCount: staged.objectCount,
      nodeCount: staged.nodeCount,
      rootCount: staged.rootCount
    }
  };
};
