import type { ServerModel } from "$runtime/server/start.server";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { completeTranslation, prepareTranslation } from "$representation/data/behavior/semantic/translation";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SemanticResourceProjection } from "$representation/data/types/semantic/source";
import type { TranslationResult } from "$representation/data/types/semantic/translation";
import { semanticTranslationConfiguration } from "$capabilities/semantic-overlay/api/shared/configuration";
import { publishSemanticTranslation } from "$capabilities/semantic-overlay/api/shared/publication";
import { readSemanticResourceForModel } from "$capabilities/semantic-overlay/api/shared/resource";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";
import type { SyncSemanticResourceResult } from "$capabilities/semantic-overlay/types/sync-semantic-resource";

const currentResult = (
  model: ServerModel,
  projectId: Id<"projects">,
  projection: SemanticResourceProjection
): SyncSemanticResourceResult | undefined => {
  const source = rowsOf(model.store, "semanticSources").find(
    (row) => row.projectId === projectId && sameResourceRef(row.ref, projection.ref)
  );
  if (
    source?.revision !== projection.revision ||
    source.contentHash !== projection.contentHash
  ) return undefined;
  const overlay = rowsOf(model.store, "semanticOverlays")
    .filter((row) => row.projectId === projectId)
    .sort((left, right) => right.generation - left.generation)[0];
  return {
    outcome: "current",
    ref: projection.ref,
    revision: projection.revision,
    overlayGeneration: overlay?.generation ?? 0,
    objectCount: rowsOf(model.store, "semanticObjects").filter(
      (row) =>
        row.projectId === projectId &&
        row.lane === "text" &&
        "semanticSourceId" in row &&
        row.semanticSourceId === source._id
    ).length,
    usage: []
  };
};

const sameProjection = (
  left: SemanticResourceProjection | undefined,
  right: SemanticResourceProjection
): boolean =>
  left !== undefined &&
  left.revision === right.revision &&
  left.contentHash === right.contentHash &&
  left.text === right.text &&
  left.encoding === right.encoding &&
  JSON.stringify(left.hardBoundaries) === JSON.stringify(right.hardBoundaries);

/** Internal worker seam: identity has already been resolved by the caller. */
export const syncSemanticResourceFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  force = false,
  assertClaim?: (unit: StoreUnitOfWork) => void,
  signal?: AbortSignal
): Promise<SyncSemanticResourceResult> => {
  signal?.throwIfAborted();
  const projection = await readSemanticResourceForModel(model, projectId, ref, signal);
  if (projection === undefined) return { outcome: "missing", ref };
  const current = currentResult(model, projectId, projection);
  if (!force && current !== undefined) return current;

  let translation: TranslationResult;
  if (!projection.text.trim()) {
    translation = { source: projection, objects: [], usage: [] };
  } else {
    const tokenField = await model.embedding.tokenField(projection.text, signal);
    const prepared = prepareTranslation(
      projection,
      tokenField.value,
      semanticTranslationConfiguration(model.configuration)
    );
    const passages = await model.embedding.windowedPassages(
      prepared.spans.map((span) => span.text),
      signal
    );
    translation = completeTranslation(prepared, passages.value, [
      tokenField.usage,
      passages.usage
    ]);
  }

  signal?.throwIfAborted();
  const latest = await readSemanticResourceForModel(model, projectId, ref, signal);
  if (!sameProjection(latest, projection)) {
    const overlay = rowsOf(model.store, "semanticOverlays")
      .filter((row) => row.projectId === projectId)
      .sort((left, right) => right.generation - left.generation)[0];
    return {
      outcome: "superseded",
      ref: projection.ref,
      revision: latest?.revision ?? projection.revision,
      overlayGeneration: overlay?.generation ?? 0,
      objectCount: 0,
      usage: translation.usage
    };
  }

  signal?.throwIfAborted();
  const published = model.store.transaction((unit) => {
    assertClaim?.(unit);
    return publishSemanticTranslation(semanticUnitModel(model, unit), projectId, translation, force);
  });
  model.observability.logger.info("semanticOverlay.resourceSynced", {
    projectId,
    ref: projection.ref,
    revision: projection.revision,
    outcome: published.outcome,
    generation: published.overlayGeneration,
    objectCount: published.objectCount
  });
  if (published.outcome === "published") {
    return {
      outcome: "published",
      ref: projection.ref,
      revision: projection.revision,
      overlayGeneration: published.overlayGeneration,
      objectCount: published.objectCount,
      index: published.index,
      usage: translation.usage
    };
  }
  return {
    outcome: published.outcome,
    ref: projection.ref,
    revision: projection.revision,
    overlayGeneration: published.overlayGeneration,
    objectCount: published.objectCount,
    usage: translation.usage
  };
};
