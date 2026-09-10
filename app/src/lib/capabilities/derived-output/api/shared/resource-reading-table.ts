import { tableMatrix } from "$representation/data/behavior/semantic/materials/profile";
import type { TableBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { MaterialNativeCitation } from "$representation/data/types/semantic/derived-output";
import type { MaterialSourceSnapshot } from "$representation/data/types/semantic/material";
import { integer } from "$capabilities/derived-output/api/shared/resource-reading-values";

type ReadContentTableInput = {
  held: Record<string, unknown>;
  block: TableBlock;
  snapshot: MaterialSourceSnapshot;
  materialId: Id<"semanticMaterials">;
  generation: number;
  issue(key: unknown, citation: Omit<MaterialNativeCitation, "selections">): string;
};

export const readContentTable = ({
  held,
  block,
  snapshot,
  materialId,
  generation,
  issue
}: ReadContentTableInput) => {
  const matrix = tableMatrix(block);
  if (matrix.length === 0) throw new Error("table contains no rows");
  const rowFrom =
    held.rowFrom === undefined ? 0 : integer(held.rowFrom, "rowFrom", 0, matrix.length - 1);
  const rowTo =
    held.rowTo === undefined
      ? Math.min(matrix.length, rowFrom + 100)
      : integer(held.rowTo, "rowTo", rowFrom + 1, Math.min(matrix.length, rowFrom + 100));
  const width = matrix.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  if (width === 0) throw new Error("table contains no columns");
  const columnFrom =
    held.columnFrom === undefined ? 0 : integer(held.columnFrom, "columnFrom", 0, width - 1);
  const columnTo =
    held.columnTo === undefined
      ? Math.min(width, columnFrom + 50)
      : integer(held.columnTo, "columnTo", columnFrom + 1, Math.min(width, columnFrom + 50));
  const rows = matrix.slice(rowFrom, rowTo).map((row) => row.slice(columnFrom, columnTo));
  const selection = {
    kind: "table" as const,
    rows: Array.from({ length: rowTo - rowFrom }, (_, index) => rowFrom + index),
    columns: Array.from({ length: columnTo - columnFrom }, (_, index) => columnFrom + index)
  };
  const value = { rowFrom, rowTo, columnFrom, columnTo, rows };
  const evidenceId = issue(["table", materialId, selection], {
    evidenceKind: "structured",
    distance: 1,
    material: snapshot,
    selection,
    value,
    overlayGeneration: generation
  });
  return { evidenceId, ...value };
};
