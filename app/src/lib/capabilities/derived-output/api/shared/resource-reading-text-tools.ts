import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import {
  admitResourceRef,
  externalFileResourceKind,
  isResourceSelectorKind,
  kindMatches
} from "$representation/data/behavior/core/resource";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { rowsOf } from "$capabilities/derived-output/api/shared/rows";
import type { ResourceReadingContext } from "$capabilities/derived-output/api/shared/resource-reading-context";
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";
import {
  flattenBlocks,
  page,
  record,
  samePath,
  text
} from "$capabilities/derived-output/api/shared/resource-reading-values";

export const textReadingTools = (context: ResourceReadingContext): IntelligenceTool[] => {
  const { input, allowed, directText, exactProjection, slideDeck } = context;
  return [
    {
      ...describedAgentTool("read_selection"),
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => {
        if (input.selection === undefined) throw new Error("this run has no user selection");
        return directText({
          kind: input.selection.ref.kind,
          resourceId: input.selection.ref.id,
          from: input.selection.from,
          to: input.selection.to
        });
      }
    },
    {
      ...describedAgentTool("find_resources"),
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          kinds: { type: "array", items: { type: "string" }, maxItems: 20 },
          cursor: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "find_resources input must be an object");
        const query = typeof held.query === "string" ? held.query.trim().toLowerCase() : "";
        const kinds = Array.isArray(held.kinds)
          ? new Set(held.kinds.filter(isResourceSelectorKind))
          : undefined;
        const paging = page(value);
        const resources: Array<{
          ref: ResourceRef;
          name: string;
          projectId: string;
        }> = [
          ...rowsOf(input.model.store, "documents").map((row) => ({
            ref: { kind: "document" as const, id: row._id },
            name: row.title,
            projectId: row.projectId
          })),
          ...rowsOf(input.model.store, "slideDecks").map((row) => ({
            ref: { kind: "slides" as const, id: row._id },
            name: row.title,
            projectId: row.projectId
          })),
          ...rowsOf(input.model.store, "spreadsheets").map((row) => ({
            ref: { kind: "spreadsheet" as const, id: row._id },
            name: row.title,
            projectId: row.projectId
          })),
          ...rowsOf(input.model.store, "externalFiles").map((row) => ({
            ref: {
              kind: externalFileResourceKind(row.subkind),
              id: row._id
            },
            name: row.name,
            projectId: row.projectId
          }))
        ].filter(
          (resource) =>
            resource.projectId === input.projectId &&
            allowed(resource.ref) &&
            (!query || resource.name.toLowerCase().includes(query)) &&
            (kinds === undefined ||
              [...kinds].some((kind) => kindMatches(kind, resource.ref.kind)))
        );
        const items = resources
          .slice(paging.cursor, paging.cursor + paging.limit)
          .map(({ ref, name }) => ({ ref, name }));
        return {
          items,
          nextCursor:
            paging.cursor + items.length < resources.length ? paging.cursor + items.length : null
        };
      }
    },
    {
      ...describedAgentTool("list_document_blocks"),
      inputSchema: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          area: {
            type: "string",
            enum: ["body", "header", "firstPageHeader", "footer", "firstPageFooter"]
          },
          cursor: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        },
        required: ["resourceId"],
        additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "list_document_blocks input must be an object");
        const ref = admitResourceRef(
          { kind: "document", id: text(held.resourceId, "resourceId") },
          "document resource"
        );
        if (!allowed(ref)) {
          throw new Error("document is outside the Derived Output Resource Set");
        }
        const leader = rowsOf(input.model.store, "documentSnapshots").find(
          (row) =>
            row.projectId === input.projectId &&
            row.resourceId === ref.id &&
            row.role === "leader"
        );
        if (leader === undefined) throw new Error("document does not exist");
        const area = held.area === undefined ? "body" : text(held.area, "area");
        if (!["body", "header", "firstPageHeader", "footer", "firstPageFooter"].includes(area)) {
          throw new Error("area is not a recognized document area");
        }
        const areas = {
          body: leader.body.rows,
          header: leader.body.header?.rows ?? [],
          firstPageHeader: leader.body.header?.firstPageRows ?? [],
          footer: leader.body.footer?.rows ?? [],
          firstPageFooter: leader.body.footer?.firstPageRows ?? []
        };
        const documentArea = area as keyof typeof areas;
        const projection = await exactProjection(ref);
        const paging = page(value);
        const blocks = areas[documentArea].flatMap((row) =>
          row.kind === "blocks"
            ? flattenBlocks(row.blocks).map(({ block, blockPath }) => ({
                area: documentArea,
                rowId: row.id,
                blockPath,
                type: block.type,
                ranges: projection.locators.flatMap((entry) =>
                  entry.locator.kind === "documentBlock" &&
                  entry.locator.area === documentArea &&
                  entry.locator.rowId === row.id &&
                  samePath(entry.locator.blockPath, blockPath)
                    ? [{ from: entry.from, to: entry.to }]
                    : []
                )
              }))
            : []
        );
        const items = blocks.slice(paging.cursor, paging.cursor + paging.limit);
        return {
          area: documentArea,
          revision: leader.revision,
          items,
          nextCursor:
            paging.cursor + items.length < blocks.length ? paging.cursor + items.length : null
        };
      }
    },
    {
      ...describedAgentTool("list_deck_slides"),
      inputSchema: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          cursor: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        },
        required: ["resourceId"],
        additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "list_deck_slides input must be an object");
        const ref = admitResourceRef(
          { kind: "slides", id: text(held.resourceId, "resourceId") },
          "slide-deck resource"
        );
        if (!allowed(ref)) throw new Error("deck is outside the Derived Output Resource Set");
        const { body } = slideDeck(ref);
        const paging = page(value);
        const visible = body.slides.filter((slide) => slide.hidden !== true);
        const items = visible
          .slice(paging.cursor, paging.cursor + paging.limit)
          .map((slide, offset) => ({
            slideId: slide.id,
            position: paging.cursor + offset + 1
          }));
        return {
          items,
          nextCursor:
            paging.cursor + items.length < visible.length ? paging.cursor + items.length : null
        };
      }
    },
    {
      ...describedAgentTool("read_text"),
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string" },
          resourceId: { type: "string" },
          from: { type: "integer", minimum: 0 },
          to: { type: "integer", minimum: 1 }
        },
        required: ["kind", "resourceId", "from", "to"],
        additionalProperties: false
      },
      execute: async (value) => directText(value)
    }
  ];
};
