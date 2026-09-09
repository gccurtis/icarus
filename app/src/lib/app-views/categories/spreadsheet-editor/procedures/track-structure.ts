import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

export const predecessorOf = (
  ordered: readonly { id: string }[],
  index: number,
  going: ReadonlySet<string>
): string | null => {
  for (let at = index - 1; at >= 0; at -= 1) {
    const candidate = ordered[at].id;
    if (!going.has(candidate)) return candidate;
  }
  return null;
};

export const moved = (
  ordered: readonly { id: string }[],
  from: number,
  to: number,
  target: "gridRow" | "gridColumn"
): SpreadsheetOp | undefined => {
  const held = ordered[from];
  if (held === undefined || from === to || to < 0 || to >= ordered.length) return undefined;
  const without = ordered.filter((_, index) => index !== from);
  return {
    op: "move",
    target,
    path: target === "gridRow" ? "rows" : "columns",
    id: held.id,
    after: to === 0 ? null : without[to - 1].id,
    wasAfter: from === 0 ? null : ordered[from - 1].id
  };
};

export const copied = (cell: SheetCell): Omit<SheetCell, "rowId" | "columnId"> => ({
  value: cell.value,
  ...(cell.expression === undefined ? {} : { expression: cell.expression }),
  ...(cell.anchors === undefined ? {} : { anchors: [...cell.anchors] }),
  ...(cell.format === undefined ? {} : { format: cell.format }),
  ...(cell.marks === undefined ? {} : { marks: cell.marks })
});
