import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";

import { stageSemanticIndex } from "$capabilities/semantic-overlay/api/shared/index-publication";
import { ensureSemanticOverlay } from "$capabilities/semantic-overlay/api/shared/publication";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { validateRetireSemanticResource } from "$capabilities/semantic-overlay/api/retire-semantic-resource/validate-retire-semantic-resource";
import type { RetireSemanticResourceResult } from "$capabilities/semantic-overlay/types/retire-semantic-resource";

type TextObject = Extract<TableRow<"semanticObjects">, { lane: "text" }>;
type MaterialObject = Extract<TableRow<"semanticObjects">, { lane: "material" }>;

/**
 * Removes one resource's active semantic products and jobs behind replacement
 * indexes. It is idempotent and deliberately does not remove the source row or bytes.
 */
export const retireSemanticResource = async (
  input: unknown
): Promise<RetireSemanticResourceResult> => {
  const scope = await requireScope();
  const asked = validateRetireSemanticResource(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const sources = rowsOf(model.store, "semanticSources").filter(
    (row) => row.projectId === projectId && row.ref.id === asked.ref.id
  );
  const sourceIds = new Set(sources.map((source) => source._id));
  const textObjects = rowsOf(model.store, "semanticObjects").flatMap((row): TextObject[] =>
    row.projectId === projectId &&
    (row.lane ?? "text") === "text" &&
    "semanticSourceId" in row &&
    sourceIds.has(row.semanticSourceId)
      ? [row as TextObject]
      : []
  );
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (row) =>
      row.projectId === projectId &&
      row.source.kind === "externalFile" &&
      row.source.fileId === asked.ref.id
  );
  const materialIds = new Set(materials.map((material) => material._id));
  const materialObjects = rowsOf(model.store, "semanticObjects").flatMap((row): MaterialObject[] =>
    row.projectId === projectId &&
    row.lane === "material" &&
    materialIds.has(row.semanticMaterialId)
      ? [row as MaterialObject]
      : []
  );
  const placements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (row) =>
      row.projectId === projectId &&
      (materialIds.has(row.semanticMaterialId) || row.ref.id === asked.ref.id)
  );
  const exactJobs = rowsOf(model.store, "semanticSyncJobs").filter(
    (row) => row.projectId === projectId && row.ref.id === asked.ref.id
  );
  const materialJobs = rowsOf(model.store, "semanticMaterialJobs").filter(
    (row) => row.projectId === projectId && row.ref.id === asked.ref.id
  );
  const affected =
    sources.length + materials.length + textObjects.length + materialObjects.length > 0;
  const heldOverlay = rowsOf(model.store, "semanticOverlays")
    .filter((row) => row.projectId === projectId)
    .sort((left, right) => right.generation - left.generation)[0];
  const generationBefore = heldOverlay?.generation ?? 0;
  let stagedText: ReturnType<typeof stageSemanticIndex> | undefined;
  let stagedMaterial: ReturnType<typeof stageSemanticIndex> | undefined;

  if (affected) {
    const overlay = heldOverlay ?? ensureSemanticOverlay(model, projectId);
    const removedText = new Set(textObjects.map((object) => object._id));
    const removedMaterial = new Set(materialObjects.map((object) => object._id));
    try {
      stagedText = stageSemanticIndex(
        model,
        projectId,
        overlay,
        rowsOf(model.store, "semanticObjects")
          .filter((row) =>
            row.projectId === projectId &&
            (row.lane ?? "text") === "text" &&
            !removedText.has(row._id)
          )
          .map((row) => ({ id: row._id, vector: row.vector })),
        "text"
      );
      stagedMaterial = stageSemanticIndex(
        model,
        projectId,
        overlay,
        rowsOf(model.store, "semanticObjects")
          .filter((row) =>
            row.projectId === projectId &&
            row.lane === "material" &&
            !removedMaterial.has(row._id)
          )
          .map((row) => ({ id: row._id, vector: row.vector })),
        "material"
      );
    } catch (error) {
      stagedText?.rollback();
      stagedMaterial?.rollback();
      throw error;
    }
  }

  const generationAfter = affected ? generationBefore + 1 : generationBefore;
  const at = Date.now();
  if (textObjects.length > 0) {
    const sourceById = new Map(sources.map((source) => [source._id, source]));
    model.store.createMany("semanticObjectHistory", textObjects.map((object) => {
      const source = sourceById.get(object.semanticSourceId)!;
      return {
        projectId,
        retiredGeneration: generationAfter,
        object: {
          lane: "text" as const,
          source: {
            ref: source.ref,
            revision: source.revision,
            ...(source.contentHash === undefined ? {} : { contentHash: source.contentHash }),
            encoding: source.encoding
          },
          span: object.span,
          vector: object.vector
        },
        retiredAt: at
      };
    }));
    model.store.removeRows("semanticObjects", textObjects.map((object) => object._id));
  }
  if (materialObjects.length > 0) {
    model.store.createMany("semanticObjectHistory", materialObjects.map((object) => ({
      projectId,
      retiredGeneration: generationAfter,
      object: {
        lane: "material" as const,
        semanticMaterialId: object.semanticMaterialId,
        facet: object.facet,
        ...(object.facetText === undefined ? {} : { facetText: object.facetText }),
        inputHash: object.inputHash,
        ...(object.scopeRefs === undefined ? {} : { scopeRefs: object.scopeRefs }),
        vector: object.vector
      },
      retiredAt: at
    })));
    model.store.removeRows("semanticObjects", materialObjects.map((object) => object._id));
  }
  if (placements.length > 0) {
    model.store.removeRows("semanticMaterialPlacements", placements.map((row) => row._id));
  }
  if (materials.length > 0) {
    model.store.createMany("semanticMaterialHistory", materials.map((material) => {
      const { _id, _creationTime, ...fields } = material;
      void _id;
      void _creationTime;
      return { projectId, retiredGeneration: generationAfter, material: fields, retiredAt: at };
    }));
    model.store.removeRows("semanticMaterials", materials.map((row) => row._id));
  }
  if (sources.length > 0) {
    model.store.removeRows("semanticSources", sources.map((row) => row._id));
  }
  if (exactJobs.length > 0) {
    model.store.removeRows("semanticSyncJobs", exactJobs.map((row) => row._id));
  }
  if (materialJobs.length > 0) {
    model.store.removeRows("semanticMaterialJobs", materialJobs.map((row) => row._id));
  }
  if (affected) {
    const overlay = heldOverlay ?? rowsOf(model.store, "semanticOverlays").find(
      (row) => row.projectId === projectId
    );
    if (overlay === undefined) throw new Error("Semantic Overlay was not readable during retirement");
    model.store.update(`semanticOverlays.${overlay._id}.generation`, generationAfter);
    model.store.update(`semanticOverlays.${overlay._id}.updatedAt`, at);
    stagedText?.commit();
    stagedMaterial?.commit();
  }

  return {
    ref: asked.ref,
    exactSources: sources.length,
    materials: materials.length,
    objects: textObjects.length + materialObjects.length,
    placements: placements.length,
    jobs: exactJobs.length + materialJobs.length,
    generationBefore,
    generationAfter
  };
};
