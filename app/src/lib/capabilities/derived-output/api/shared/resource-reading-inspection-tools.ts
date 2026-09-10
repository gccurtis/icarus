import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import type { MaterialSourceSnapshot } from "$representation/data/types/semantic/material";
import { materialRecordIsCurrent } from "$capabilities/semantic-overlay";
import { rowsOf } from "$capabilities/derived-output/api/shared/rows";
import type { ResourceReadingContext } from "$capabilities/derived-output/api/shared/resource-reading-context";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";
import {
  placedElements,
  record,
  samePath,
  text
} from "$capabilities/derived-output/api/shared/resource-reading-values";

export const materialInspectionTools = (
  context: ResourceReadingContext
): IntelligenceTool[] => {
  const { input, allowed, materialFor, rememberMaterial, exactProjection, slideDeck } = context;
  return [
    {
      ...describedAgentTool("inspect_dataset"),
      inputSchema: {
        type: "object",
        properties: { materialHandle: { type: "string" } },
        required: ["materialHandle"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { material } = materialFor(value);
        if (material.kind !== "table" && material.kind !== "csv") {
          throw new Error("material is not a dataset");
        }
        if (material.profile.kind !== "table" && material.profile.kind !== "csv") {
          throw new Error("dataset profile is unavailable");
        }
        return {
          name: material.name,
          kind: material.kind,
          shape: {
            rows: material.profile.rows,
            columns: material.profile.columns,
            headers: material.profile.headers.slice(0, 50)
          },
          columns: material.profile.columnsProfile.slice(0, 50).map((column) => ({
            name: column.name,
            inferredType: column.inferredType,
            nullCount: column.nullCount,
            ...(column.distinctCount === undefined ? {} : { distinctCount: column.distinctCount })
          })),
          coverage:
            material.profile.kind === "csv"
              ? {
                  sampledRows: material.profile.sampledRows,
                  truncated: material.profile.truncated
                }
              : {
                  sampledRows: material.profile.sample.length,
                  truncated: material.profile.sample.length < material.profile.rows
                },
          warnings: material.profile.warnings,
          reader: material.kind === "csv" ? "read_csv" : "read_table",
          materialHandle: text(record(value, "input").materialHandle, "materialHandle")
        };
      }
    },
    {
      ...describedAgentTool("inspect_code"),
      inputSchema: {
        type: "object",
        properties: { materialHandle: { type: "string" } },
        required: ["materialHandle"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { material } = materialFor(value);
        if (material.kind !== "code" || material.profile.kind !== "code") {
          throw new Error("material is not code");
        }
        return {
          name: material.name,
          language: material.profile.language,
          lines: material.profile.lines,
          symbols: material.profile.symbols
        };
      }
    },
    {
      ...describedAgentTool("inspect_slide"),
      inputSchema: {
        type: "object",
        properties: { resourceId: { type: "string" }, slideId: { type: "string" } },
        required: ["resourceId", "slideId"],
        additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "inspect_slide input must be an object");
        const ref = admitResourceRef(
          { kind: "slides", id: text(held.resourceId, "resourceId") },
          "slide-deck resource"
        );
        if (!allowed(ref)) throw new Error("slide is outside the Derived Output Resource Set");
        const slideId = text(held.slideId, "slideId");
        const { leader, body } = slideDeck(ref);
        const slide = body.slides.find((candidate) => candidate.id === slideId);
        if (slide === undefined) throw new Error("slide does not exist");
        const projection = await exactProjection(ref);
        const projectPlacements = rowsOf(
          input.model.store,
          "semanticMaterialPlacements"
        ).filter((placement) => placement.projectId === input.projectId);
        const materials = rowsOf(input.model.store, "semanticMaterials").filter(
          (material) => material.projectId === input.projectId
        );
        const slidePlacements = projectPlacements.filter(
          (placement) =>
            placement.ref.kind === "slides" &&
            placement.ref.id === ref.id &&
            placement.revision === leader.revision &&
            (placement.locator.kind === "slideElement" ||
              placement.locator.kind === "slideBackground") &&
            placement.locator.slideId === slideId
        );
        const materialEntry = (placement: (typeof slidePlacements)[number]) => {
          const material = materials.find(
            (candidate) => candidate._id === placement.semanticMaterialId
          );
          if (
            material === undefined ||
            material.state !== "ready" ||
            !materialRecordIsCurrent(
              input.model.store,
              input.projectId,
              material,
              projectPlacements
            )
          ) {
            return undefined;
          }
          const snapshot: MaterialSourceSnapshot = {
            materialId: material._id,
            kind: material.kind,
            name: material.name,
            source: material.source,
            profileHash: material.profileHash,
            contextHash: material.contextHash,
            revisionKey: material.revisionKey,
            placement: { ref, revision: placement.revision, locator: placement.locator }
          };
          return {
            kind: material.kind,
            name: material.name,
            materialHandle: rememberMaterial(snapshot),
            locator: placement.locator
          };
        };
        const materialEntries = slidePlacements.flatMap((placement) => {
          const entry = materialEntry(placement);
          return entry === undefined ? [] : [entry];
        });
        const items = placedElements(slide.elements).map(
          ({ element, elementPath: path, frame }) => {
            const ranges = projection.locators.flatMap((entry) =>
              entry.locator.kind === "slideElement" &&
              entry.locator.slideId === slideId &&
              samePath(entry.locator.elementPath, path)
                ? [{ from: entry.from, to: entry.to, blockPath: entry.locator.blockPath }]
                : []
            );
            const ownMaterials = materialEntries.filter(
              (entry) =>
                entry.locator.kind === "slideElement" &&
                samePath(entry.locator.elementPath, path)
            );
            return {
              id: element.id,
              elementPath: path,
              type: element.content.type,
              frame,
              ...(element.rotation === undefined ? {} : { rotation: element.rotation }),
              ranges,
              materials: ownMaterials,
              materialHandle: ownMaterials[0]?.materialHandle ?? null
            };
          }
        );
        const notes = slide.notes.map((block) => ({
          blockPath: [block.id],
          type: block.type,
          ranges: projection.locators.flatMap((entry) =>
            entry.locator.kind === "slideNote" &&
            entry.locator.slideId === slideId &&
            samePath(entry.locator.blockPath, [block.id])
              ? [{ from: entry.from, to: entry.to }]
              : []
          )
        }));
        return {
          slideId,
          revision: leader.revision,
          background: slide.background?.kind ?? null,
          backgroundMaterials: materialEntries.filter(
            (entry) => entry.locator.kind === "slideBackground"
          ),
          items,
          notes,
          view: { tool: "view_slide", kind: "schematic", citable: false }
        };
      }
    }
  ];
};
