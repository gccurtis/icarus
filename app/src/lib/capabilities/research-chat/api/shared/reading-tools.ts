import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import { sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import { tableMatrix } from "$representation/data/behavior/semantic/materials/profile";
import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { SlideElement } from "$representation/data/types/slide-decks/body";
import type { MaterialLocator } from "$representation/data/types/semantic/material";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import { readSemanticResourceForModel } from "$capabilities/semantic-overlay";

import { rowsIn } from "$capabilities/research-chat/api/shared/store";
import {
  asRecord,
  type ToolContext
} from "$capabilities/research-chat/api/shared/tool-kit";

/**
 * Reading, as distinct from searching.
 *
 * Retrieval answers "where is this said"; these answer "what does it actually
 * say". read_table is the only one that reaches an authored block's cells, and
 * it is the difference between describing a table and quoting its numbers.
 */
export const readingTools = (context: ToolContext): readonly IntelligenceTool[] => {
  const readText: IntelligenceTool = {
    name: "read_text",
    description:
      "Read a stretch of one resource exactly as it is written, to check a passage or read around it. Give the resource kind and id from a retrieve result.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", minLength: 1, maxLength: 64 },
        id: { type: "string", minLength: 1, maxLength: 200 },
        from: { type: "integer", minimum: 0 },
        to: { type: "integer", minimum: 1 }
      },
      required: ["kind", "id", "from", "to"],
      additionalProperties: false
    },
    execute: async (value) => {
      const asked = asRecord(value, "the input must be an object");
      const ref = admitResourceRef(
        { kind: asked.kind, id: asked.id },
        "read_text resource"
      );
      if (!context.inScope(ref)) throw new Error("that resource is not in this turn's scope");
      const from = Number(asked.from);
      const to = Number(asked.to);
      if (!Number.isInteger(from) || !Number.isInteger(to) || to <= from) {
        throw new Error("from and to must be whole numbers with to greater than from");
      }
      if (to - from > 12_000) throw new Error("read at most 12000 characters at a time");
      const projection = await readSemanticResourceForModel(
        context.input.model,
        context.input.projectId,
        ref,
        context.input.signal
      );
      if (projection === undefined) throw new Error("that resource has no readable text");
      const text = sliceByCoordinates(projection.text, projection.encoding, from, to);
      const sourceId = context.issue(JSON.stringify(["text", ref, from, to]), {
        ref,
        title: context.nameOf(ref),
        locator: `characters ${from} to ${to}`,
        excerpt: text
      });
      return { sourceId, resource: context.nameOf(ref), from, to, text };
    }
  };

  const listResources: IntelligenceTool = {
    name: "list_resources",
    description:
      "List what this project holds, by name and kind, when you need to know what exists before searching it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => ({
      resources: context.resources
        .filter((resource) => context.inScope(resource.ref))
        .map((resource) => ({
          kind: resource.ref.kind,
          id: resource.ref.id,
          name: resource.name
        }))
    })
  };

  const findElement = (
    elements: readonly SlideElement[],
    path: readonly string[]
  ): SlideElement | undefined => {
    const [id, ...rest] = path;
    const element = elements.find((candidate) => candidate.id === id);
    if (element === undefined) return undefined;
    if (rest.length === 0) return element;
    return element.content.type === "group" ? findElement(element.content.children, rest) : undefined;
  };

  const findBlock = (blocks: readonly ContentBlock[], id: string): ContentBlock | undefined => {
    for (const block of blocks) {
      if (block.id === id) return block;
      if (block.type === "table") {
        for (const row of block.rows) {
          for (const cell of row.cells) {
            const found = findBlock(cell.blocks, id);
            if (found !== undefined) return found;
          }
        }
      }
    }
    return undefined;
  };

  /** The authored block a material was profiled from, wherever it lives. */
  const blockAt = (ref: ResourceRef, locator: MaterialLocator): ContentBlock => {
    if (locator.kind === "documentBlock") {
      const snapshot = rowsIn(context.input.model.store, "documentSnapshots").find(
        (row) =>
          row.projectId === context.input.projectId && row.resourceId === ref.id && row.role === "leader"
      );
      if (snapshot === undefined) throw new Error("that document is unavailable");
      const areas = {
        body: snapshot.body.rows,
        header: snapshot.body.header?.rows ?? [],
        firstPageHeader: snapshot.body.header?.firstPageRows ?? [],
        footer: snapshot.body.footer?.rows ?? [],
        firstPageFooter: snapshot.body.footer?.firstPageRows ?? []
      };
      const row = areas[locator.area].find((candidate) => candidate.id === locator.rowId);
      if (row?.kind !== "blocks") throw new Error("that row is unavailable");
      const block = findBlock(row.blocks, locator.blockPath.at(-1) ?? "");
      if (block === undefined) throw new Error("that block is unavailable");
      return block;
    }
    if (locator.kind !== "slideElement") throw new Error("that material is not a readable block");
    const leader = rowsIn(context.input.model.store, "slideDeckSnapshots").find(
      (row) => row.projectId === context.input.projectId && row.resourceId === ref.id && row.role === "leader"
    );
    if (leader === undefined) throw new Error("that slide deck is unavailable");
    const body = leader.body;
    const slide = body.slides.find((candidate) => candidate.id === locator.slideId);
    const element = slide === undefined ? undefined : findElement(slide.elements, locator.elementPath);
    if (element === undefined) throw new Error("that slide element is unavailable");
    const content = element.content;
    const root =
      content.type === "text" ||
      content.type === "formula" ||
      content.type === "prompt" ||
      content.type === "image" ||
      content.type === "table" ||
      content.type === "shape"
        ? content.block
        : undefined;
    if (root === undefined) throw new Error("that slide element holds no readable block");
    if (locator.blockPath === undefined) return root;
    const nested = findBlock([root], locator.blockPath.at(-1) ?? "");
    return nested ?? root;
  };

  const readTable: IntelligenceTool = {
    name: "read_table",
    description:
      "Read a table's actual cells, row by row. retrieve_materials describes a table; this is the only way to get the numbers in it. Give the materialHandle from a retrieve_materials result.",
    inputSchema: {
      type: "object",
      properties: {
        materialHandle: { type: "string", minLength: 1, maxLength: 200 },
        rowFrom: { type: "integer", minimum: 0 },
        rowTo: { type: "integer", minimum: 1 }
      },
      required: ["materialHandle"],
    additionalProperties: false
    },
    execute: async (value) => {
      const asked = asRecord(value, "the input must be an object");
      if (
        typeof asked.materialHandle !== "string" ||
        asked.materialHandle.length === 0 ||
        asked.materialHandle.length > 200
      ) {
        throw new Error("materialHandle must be a non-empty string of at most 200 characters");
      }
      const handle = asked.materialHandle;
      const snapshot = context.materials.get(handle);
      if (snapshot === undefined) {
        throw new Error("that materialHandle was not issued in this conversation; search first");
      }
      const ref = snapshot.placement?.ref ?? snapshot.source.ref;
      if (!context.inScope(ref)) throw new Error("that table is not in this turn's scope");
      const material = rowsIn(context.input.model.store, "semanticMaterials").find(
        (row) => row._id === snapshot.materialId && row.projectId === context.input.projectId
      );
      if (material === undefined) throw new Error("that table is no longer in the project");
      if (material.kind !== "table") throw new Error("that material is not a table");
      if (material.source.kind !== "resourceContent") {
        throw new Error("that table lives in an uploaded file, which cannot be read yet");
      }
      const block = blockAt(ref, material.source.locator);
      if (block.type !== "table") throw new Error("that material is no longer a table");
      const matrix = tableMatrix(block);
      const rowFrom = Number.isInteger(asked.rowFrom) ? Math.max(0, Number(asked.rowFrom)) : 0;
      const rowTo = Number.isInteger(asked.rowTo)
        ? Math.min(matrix.length, Number(asked.rowTo))
        : Math.min(matrix.length, rowFrom + 200);
      const rows = matrix.slice(rowFrom, Math.max(rowFrom + 1, rowTo)).map((row) => row.slice(0, 50));
      const sourceId = context.issue(
        JSON.stringify(["table", material._id, material.revisionKey, rowFrom, rowTo]),
        {
          ref,
          title: material.name,
          locator: `rows ${rowFrom} to ${rowFrom + rows.length}`,
          excerpt: rows
            .slice(0, 4)
            .map((row) => row.join(" · "))
            .join(" / ")
        }
      );
      context.returned.push(rows.length);
      return {
        sourceId,
        name: material.name,
        resource: context.nameOf(ref),
        headerRows: block.headerRows,
        totalRows: matrix.length,
        rowFrom,
        rows
      };
    }
  };

  return [readText, readTable, listResources];
};
