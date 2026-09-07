import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { MaterialSeed, SpreadsheetMaterialProfile } from "$representation/data/types/semantic/material";
import { columnProfiles } from "$representation/data/behavior/semantic/materials/profile";

export type SpreadsheetCellInput = {
  rowId: string;
  columnId: string;
  rowOrder: number;
  value: VariableValue;
};

export const displayVariableValue = (value: VariableValue): string => {
  if (value.kind === "empty") return "";
  if (value.kind === "number" || value.kind === "text") return String(value.value);
  if (value.kind === "logic") return value.value ? "TRUE" : "FALSE";
  if (value.kind === "date") {
    const held = value.value;
    const pad = (part: number, width = 2) => String(part).padStart(width, "0");
    const date = `${pad(held.year, 4)}-${pad(held.month)}-${pad(held.day)}`;
    if (held.hour === undefined) return date;
    const time = `${pad(held.hour)}:${pad(held.minute ?? 0)}:${pad(held.second ?? 0)}.${pad(held.millisecond ?? 0, 3)}`;
    return `${date}T${time}${held.timeZone ?? "Z"}`;
  }
  if (value.kind === "reference") return `${value.target.to}:${value.target.to === "variable" ? value.target.name : value.target.ref.id}`;
  if (value.kind === "list") return value.values.map(displayVariableValue).join(", ");
  if (value.kind === "record") return JSON.stringify(value.fields);
  if (value.kind === "table") return JSON.stringify(value.rows);
  if (value.kind === "range") return `${value.from.rowId}:${value.from.columnId}-${value.to.rowId}:${value.to.columnId}`;
  return `function(${value.parameters.join(", ")})`;
};

export const projectSpreadsheetMaterial = (input: {
  ref: ResourceRef;
  revision: number;
  title: string;
  body: SpreadsheetBody;
  cells: readonly SpreadsheetCellInput[];
}): MaterialSeed => {
  const rows = [...input.body.rows].sort((left, right) => left.order - right.order);
  const columns = [...input.body.columns].sort((left, right) => left.order - right.order);
  const cellMap = new Map(input.cells.map((cell) => [`${cell.rowId}\u0000${cell.columnId}`, cell]));
  const matrix = rows.map((row) => columns.map((column) =>
    displayVariableValue(cellMap.get(`${row.id}\u0000${column.id}`)?.value ?? { kind: "empty" })
  ));
  const headers = [...(matrix[0] ?? [])];
  const values = matrix.slice(1);
  const sample = matrix.length <= 16
    ? matrix
    : Array.from({ length: 16 }, (_, index) =>
        matrix[Math.floor((index * (matrix.length - 1)) / 15)]
      );
  const profile: SpreadsheetMaterialProfile = {
    kind: "table",
    sheet: true,
    rows: matrix.length,
    columns: columns.length,
    headerRows: matrix.length > 0 ? 1 : 0,
    headers,
    columnsProfile: columnProfiles(values, headers, columns.length),
    mergedRegions: input.cells.filter((cell) => "mergedTo" in cell).length,
    sample,
    warnings: []
  };
  return {
    identityKey: JSON.stringify(["spreadsheet", input.ref]),
    kind: "table",
    name: input.title,
    source: {
      kind: "resourceContent",
      ref: input.ref,
      revision: input.revision,
      locator: {
        kind: "spreadsheet",
        rowIds: rows.map((row) => row.id),
        columnIds: columns.map((column) => column.id)
      }
    },
    placement: {
      ref: input.ref,
      revision: input.revision,
      locator: {
        kind: "spreadsheet",
        rowIds: rows.map((row) => row.id),
        columnIds: columns.map((column) => column.id)
      }
    },
    profile,
    context: { title: input.title, nearbyText: [], notes: [] }
  };
};
