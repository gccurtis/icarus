import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import { parseCsv } from "$representation/data/behavior/semantic/materials/csv";
import { rowsOf } from "$capabilities/derived-output/api/shared/rows";
import type { ResourceReadingContext } from "$capabilities/derived-output/api/shared/resource-reading-context";
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";
import {
  boundedJson,
  chartSeriesSelection,
  findElement,
  integer,
  text
} from "$capabilities/derived-output/api/shared/resource-reading-values";

export const structuredReadingTools = (
  context: ResourceReadingContext
): IntelligenceTool[] => {
  const {
    input,
    materialFor,
    materialBlock,
    tableRead,
    slideDeck,
    externalFile,
    nativeCitation,
    currentGeneration
  } = context;
  return [
    {
      ...describedAgentTool("read_table"),
      inputSchema: {
        type: "object",
        properties: {
          materialHandle: { type: "string" },
          rowFrom: { type: "integer", minimum: 0 },
          rowTo: { type: "integer", minimum: 1 },
          columnFrom: { type: "integer", minimum: 0 },
          columnTo: { type: "integer", minimum: 1 }
        },
        required: ["materialHandle"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "table" || material.profile.kind !== "table") {
          throw new Error("material is not a table");
        }
        if (material.profile.rows === 0 || material.profile.columns === 0) {
          throw new Error("table contains no readable cells");
        }
        if (
          material.source.kind === "resourceContent" &&
          material.source.locator.kind === "spreadsheet"
        ) {
          const rowFrom =
            held.rowFrom === undefined
              ? 0
              : integer(held.rowFrom, "rowFrom", 0, material.profile.rows - 1);
          const rowTo =
            held.rowTo === undefined
              ? Math.min(material.profile.rows, rowFrom + 100)
              : integer(
                  held.rowTo,
                  "rowTo",
                  rowFrom + 1,
                  Math.min(material.profile.rows, rowFrom + 100)
                );
          const columnFrom =
            held.columnFrom === undefined
              ? 0
              : integer(held.columnFrom, "columnFrom", 0, material.profile.columns - 1);
          const columnTo =
            held.columnTo === undefined
              ? Math.min(material.profile.columns, columnFrom + 50)
              : integer(
                  held.columnTo,
                  "columnTo",
                  columnFrom + 1,
                  Math.min(material.profile.columns, columnFrom + 50)
                );
          const rowIds = material.source.locator.rowIds.slice(rowFrom, rowTo);
          const columnIds = material.source.locator.columnIds.slice(columnFrom, columnTo);
          const cells = rowsOf(input.model.store, "sheetCells").filter(
            (cell) =>
              cell.projectId === input.projectId &&
              cell.resourceId === material.source.ref.id &&
              rowIds.includes(cell.rowId) &&
              columnIds.includes(cell.columnId)
          );
          const valueOut = {
            rowIds,
            columnIds,
            cells: cells.map((cell) => ({
              rowId: cell.rowId,
              columnId: cell.columnId,
              value: cell.value
            }))
          };
          const selection = {
            kind: "table" as const,
            rows: Array.from({ length: rowTo - rowFrom }, (_, index) => rowFrom + index),
            columns: Array.from(
              { length: columnTo - columnFrom },
              (_, index) => columnFrom + index
            )
          };
          const evidenceId = nativeCitation(["table", material._id, selection], {
            evidenceKind: "structured",
            distance: 1,
            material: snapshot,
            selection,
            value: valueOut,
            overlayGeneration: currentGeneration()
          });
          return { evidenceId, ...valueOut };
        }
        if (material.source.kind !== "resourceContent") {
          throw new Error("external tables use read_csv");
        }
        const block = materialBlock(
          snapshot.placement?.ref ?? snapshot.source.ref,
          material.source.locator
        );
        if (block.type !== "table") throw new Error("material source is no longer a table");
        return tableRead(held, block, snapshot, material._id);
      }
    },
    {
      ...describedAgentTool("read_chart"),
      inputSchema: {
        type: "object",
        properties: {
          materialHandle: { type: "string" },
          series: { type: "array", items: { type: "string" }, maxItems: 50 }
        },
        required: ["materialHandle"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (
          material.kind !== "chart" ||
          material.source.kind !== "resourceContent" ||
          material.source.locator.kind !== "slideElement"
        ) {
          throw new Error("material is not a native slide chart");
        }
        const ref = snapshot.placement?.ref ?? material.source.ref;
        const locator = material.source.locator;
        const deck = slideDeck(ref);
        const slide = deck.body.slides.find((candidate) => candidate.id === locator.slideId);
        const element =
          slide === undefined ? undefined : findElement(slide.elements, locator.elementPath);
        if (element?.content.type !== "chart") throw new Error("chart source is unavailable");
        const available = material.profile.kind === "chart" ? material.profile.series : [];
        const selected = Array.isArray(held.series)
          ? [...new Set(held.series.map((entry) => text(entry, "series")))]
          : available;
        if (Array.isArray(held.series) && selected.length === 0) {
          throw new Error("read_chart series must not be empty");
        }
        const missing = selected.find((series) => !available.includes(series));
        if (missing !== undefined) throw new Error(`chart series '${missing}' does not exist`);
        const native = boundedJson(chartSeriesSelection(element.content.spec, selected, available));
        const selection = { kind: "chart" as const, series: selected };
        const evidenceId = nativeCitation(["chart", material._id, selection], {
          evidenceKind: "structured",
          distance: 1,
          material: snapshot,
          selection,
          value: native,
          overlayGeneration: currentGeneration()
        });
        return { evidenceId, series: selected, spec: native };
      }
    },
    {
      ...describedAgentTool("read_csv"),
      inputSchema: {
        type: "object",
        properties: {
          materialHandle: { type: "string" },
          rows: { type: "array", items: { type: "integer", minimum: 0 }, maxItems: 100 },
          columns: { type: "array", items: { type: "string" }, maxItems: 50 }
        },
        required: ["materialHandle", "rows", "columns"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (
          material.kind !== "csv" ||
          material.profile.kind !== "csv" ||
          material.source.kind !== "externalFile"
        ) {
          throw new Error("material is not CSV");
        }
        const profile = material.profile;
        if (profile.rows === 0) throw new Error("CSV contains no data rows");
        const rows = Array.isArray(held.rows)
          ? [...new Set(held.rows.map((row) => integer(row, "row", 0, profile.rows - 1)))]
          : [];
        const columns = Array.isArray(held.columns)
          ? [...new Set(held.columns.map((column) => text(column, "column")))]
          : [];
        if (rows.length === 0 || columns.length === 0) {
          throw new Error("read_csv requires bounded rows and columns");
        }
        const file = externalFile(material.source.fileId);
        const bytes = await input.model.externalFileStorage.read({
          storageId: file.storageId,
          hash: file.hash,
          size: file.size
        }, input.signal);
        input.signal?.throwIfAborted();
        if (bytes === undefined) throw new Error("CSV native content is unavailable");
        const parsed = parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        const headers = parsed.rows[0] ?? [];
        const indexes = columns.map((column) => {
          const index = headers.indexOf(column);
          if (index < 0) throw new Error(`CSV column '${column}' does not exist`);
          return index;
        });
        const values = rows.map((row) => ({
          row,
          values: indexes.map((column) => parsed.rows[row + 1]?.[column] ?? "")
        }));
        const selection = { kind: "csv" as const, rows, columns };
        const valueOut = { headers: columns, rows: values };
        const evidenceId = nativeCitation(["csv", material._id, selection], {
          evidenceKind: "structured",
          distance: 1,
          material: snapshot,
          selection,
          value: valueOut,
          overlayGeneration: currentGeneration()
        });
        return { evidenceId, ...valueOut };
      }
    }
  ];
};
