import type { TableBlock, TableCell } from "$representation/data/types/content/content-block";
import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { SlideDeckBody, SlideElement } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";
import { emptyText } from "$app-views/categories/slide-deck-editor/procedures/deck-elements";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export type GridCell = {
  readonly cell: TableCell;
  readonly rowId: string;
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
};

export type Rectangle = {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
};

export const gridOf = (table: TableBlock): GridCell[] => {
  const taken = new Set<string>();
  const out: GridCell[] = [];
  table.rows.forEach((row, r) => {
    let c = 0;
    for (const cell of row.cells) {
      while (taken.has(`${r},${c}`)) c += 1;
      const rowSpan = Math.max(1, cell.rowSpan ?? 1);
      const columnSpan = Math.max(1, cell.columnSpan ?? 1);
      for (let dr = 0; dr < rowSpan; dr += 1) {
        for (let dc = 0; dc < columnSpan; dc += 1) taken.add(`${r + dr},${c + dc}`);
      }
      out.push({ cell, rowId: row.id, row: r, column: c, rowSpan, columnSpan });
      c += columnSpan;
    }
  });
  return out;
};

export const columnsOf = (grid: readonly GridCell[]): number =>
  grid.reduce((most, held) => Math.max(most, held.column + held.columnSpan), 0);

export const rectangleOf = (grid: readonly GridCell[], ids: readonly string[]): Rectangle | undefined => {
  const chosen = grid.filter((held) => ids.includes(held.cell.id));
  if (chosen.length === 0) return undefined;
  return {
    top: Math.min(...chosen.map((held) => held.row)),
    left: Math.min(...chosen.map((held) => held.column)),
    bottom: Math.max(...chosen.map((held) => held.row + held.rowSpan - 1)),
    right: Math.max(...chosen.map((held) => held.column + held.columnSpan - 1))
  };
};

export const isRectangular = (grid: readonly GridCell[], ids: readonly string[]): boolean => {
  const rect = rectangleOf(grid, ids);
  if (rect === undefined) return false;
  const area = (rect.bottom - rect.top + 1) * (rect.right - rect.left + 1);
  const covered = grid
    .filter((held) => ids.includes(held.cell.id))
    .reduce((sum, held) => sum + held.rowSpan * held.columnSpan, 0);
  return covered === area;
};

export const covering = (grid: readonly GridCell[], rowId: string, column: number): GridCell | undefined =>
  grid.find((held) => held.rowId === rowId && held.column <= column && held.column + held.columnSpan - 1 >= column);

const blank = (): TableCell => ({ id: mint("block"), blocks: [emptyText("caption", "")] });

const none = (body: SlideDeckBody): Edit => ({ body, ops: [] });

const finished = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): Edit =>
  ops.length === 0 ? none(body) : { body: applyOps(body, ops), ops };

const tableOf = (element: SlideElement): { table: TableBlock; rowHeights?: readonly number[] } | undefined =>
  element.content.type === "table" ? { table: element.content.block, rowHeights: element.content.rowHeights } : undefined;

const removals = (table: TableBlock, ids: readonly string[]): SlideDeckOp[] => {
  const ops: SlideDeckOp[] = [];
  for (const row of table.rows) {
    let remaining = row.cells;
    for (const going of row.cells) {
      if (!ids.includes(going.id)) continue;
      const at = remaining.findIndex((held) => held.id === going.id);
      ops.push({
        op: "remove",
        target: "block",
        path: `${row.id}/cells`,
        ids: [going.id],
        after: at <= 0 ? null : remaining[at - 1].id,
        values: [going]
      });
      remaining = remaining.filter((held) => held.id !== going.id);
    }
  }
  return ops;
};

export const withMergedCells = (body: SlideDeckBody, table: TableBlock, ids: readonly string[]): Edit => {
  const grid = gridOf(table);
  const rect = rectangleOf(grid, ids);
  if (rect === undefined || ids.length < 2 || !isRectangular(grid, ids)) return none(body);

  const chosen = grid.filter((held) => ids.includes(held.cell.id));
  const kept =
    chosen.find((held) => held.cell.id === ids[0]) ??
    [...chosen].sort((a, b) => a.row - b.row || a.column - b.column)[0];
  const rowSpan = rect.bottom - rect.top + 1;
  const columnSpan = rect.right - rect.left + 1;
  const topRow = table.rows[rect.top];
  const before = grid
    .filter((held) => held.rowId === topRow.id && held.column < rect.left && !ids.includes(held.cell.id))
    .sort((a, b) => b.column - a.column)[0]?.cell.id ?? null;
  const { rowSpan: wasRows, columnSpan: wasColumns, ...rest } = kept.cell;
  void wasRows;
  void wasColumns;
  const merged: TableCell = {
    ...rest,
    ...(rowSpan === 1 ? {} : { rowSpan }),
    ...(columnSpan === 1 ? {} : { columnSpan })
  };

  return finished(body, [
    ...removals(table, ids),
    { op: "insert", target: "block", path: `${topRow.id}/cells`, ids: [merged.id], after: before, values: [merged] }
  ]);
};

export const withSplitCell = (body: SlideDeckBody, table: TableBlock, id: string): Edit => {
  const grid = gridOf(table);
  const anchor = grid.find((held) => held.cell.id === id);
  if (anchor === undefined || (anchor.rowSpan === 1 && anchor.columnSpan === 1)) return none(body);

  const ops: SlideDeckOp[] = [];
  if (anchor.rowSpan > 1) {
    ops.push({ op: "set", target: "block", path: `${id}/rowSpan`, value: null, was: anchor.rowSpan });
  }
  if (anchor.columnSpan > 1) {
    ops.push({ op: "set", target: "block", path: `${id}/columnSpan`, value: null, was: anchor.columnSpan });
  }

  for (let r = anchor.row; r < anchor.row + anchor.rowSpan; r += 1) {
    const row = table.rows[r];
    if (row === undefined) continue;
    const count = r === anchor.row ? anchor.columnSpan - 1 : anchor.columnSpan;
    if (count === 0) continue;
    const made = Array.from({ length: count }, blank);
    const after =
      r === anchor.row
        ? id
        : (grid
            .filter((held) => held.rowId === row.id && held.column < anchor.column)
            .sort((a, b) => b.column - a.column)[0]?.cell.id ?? null);
    ops.push({ op: "insert", target: "block", path: `${row.id}/cells`, ids: made.map((cell) => cell.id), after, values: made });
  }

  return finished(body, ops);
};

const shared = (sizes: readonly number[]): number => sizes.reduce((sum, held) => sum + held, 0) / sizes.length;

const spliced = (sizes: readonly number[], at: number, insert: boolean): number[] =>
  insert
    ? [...sizes.slice(0, at), shared(sizes), ...sizes.slice(at)]
    : sizes.filter((_, index) => index !== at);

export const withRowInserted = (body: SlideDeckBody, element: SlideElement, afterIndex: number): Edit => {
  const held = tableOf(element);
  if (held === undefined) return none(body);
  const { table, rowHeights } = held;
  const columns = Math.max(1, columnsOf(gridOf(table)));
  const row = { id: mint("block"), cells: Array.from({ length: columns }, blank) };
  const anchor = afterIndex < 0 ? null : (table.rows[afterIndex]?.id ?? table.rows.at(-1)?.id ?? null);
  const ops: SlideDeckOp[] = [{ op: "insert", target: "block", path: `${table.id}/rows`, ids: [row.id], after: anchor, values: [row] }];
  if (rowHeights !== undefined && rowHeights.length === table.rows.length) {
    ops.push({
      op: "set",
      target: "element",
      path: `${element.id}/content/rowHeights`,
      value: spliced(rowHeights, Math.min(afterIndex + 1, rowHeights.length), true),
      was: rowHeights
    });
  }
  return finished(body, ops);
};

export const withRowRemoved = (body: SlideDeckBody, element: SlideElement, index: number): Edit => {
  const held = tableOf(element);
  if (held === undefined) return none(body);
  const { table, rowHeights } = held;
  const row = table.rows[index];
  if (row === undefined || table.rows.length < 2) return none(body);
  const ops: SlideDeckOp[] = [
    { op: "remove", target: "block", path: `${table.id}/rows`, ids: [row.id], after: index === 0 ? null : table.rows[index - 1].id, values: [row] }
  ];
  if (rowHeights !== undefined && rowHeights.length === table.rows.length) {
    ops.push({
      op: "set",
      target: "element",
      path: `${element.id}/content/rowHeights`,
      value: spliced(rowHeights, index, false),
      was: rowHeights
    });
  }
  return finished(body, ops);
};

export const withColumnInserted = (body: SlideDeckBody, element: SlideElement, afterColumn: number): Edit => {
  const held = tableOf(element);
  if (held === undefined) return none(body);
  const { table } = held;
  const grid = gridOf(table);
  const columns = columnsOf(grid);
  const ops: SlideDeckOp[] = table.rows.map((row) => {
    const made = blank();
    const anchor = afterColumn < 0 ? null : (covering(grid, row.id, Math.min(afterColumn, columns - 1))?.cell.id ?? row.cells.at(-1)?.id ?? null);
    return { op: "insert", target: "block", path: `${row.id}/cells`, ids: [made.id], after: anchor, values: [made] };
  });
  if (table.columnWidths !== undefined && table.columnWidths.length === columns) {
    ops.push({
      op: "set",
      target: "block",
      path: `${table.id}/columnWidths`,
      value: spliced(table.columnWidths, Math.min(afterColumn + 1, columns), true),
      was: table.columnWidths
    });
  }
  return finished(body, ops);
};

export const withColumnRemoved = (body: SlideDeckBody, element: SlideElement, column: number): Edit => {
  const held = tableOf(element);
  if (held === undefined) return none(body);
  const { table } = held;
  const grid = gridOf(table);
  const columns = columnsOf(grid);
  if (columns < 2 || column < 0 || column >= columns) return none(body);
  const ops: SlideDeckOp[] = [];
  for (const row of table.rows) {
    const found = covering(grid, row.id, column);
    if (found === undefined) continue;
    if (found.columnSpan > 1) {
      ops.push({
        op: "set",
        target: "block",
        path: `${found.cell.id}/columnSpan`,
        value: found.columnSpan === 2 ? null : found.columnSpan - 1,
        was: found.columnSpan
      });
      continue;
    }
    if (found.row !== table.rows.indexOf(row)) continue;
    const at = row.cells.findIndex((cell) => cell.id === found.cell.id);
    ops.push({ op: "remove", target: "block", path: `${row.id}/cells`, ids: [found.cell.id], after: at <= 0 ? null : row.cells[at - 1].id, values: [found.cell] });
  }
  if (table.columnWidths !== undefined && table.columnWidths.length === columns) {
    ops.push({
      op: "set",
      target: "block",
      path: `${table.id}/columnWidths`,
      value: spliced(table.columnWidths, column, false),
      was: table.columnWidths
    });
  }
  return finished(body, ops);
};
