import type {
  SurfaceMerge,
  SurfaceScene
} from "$authored-components/sheet-surface/sheet-surface-types";

/** The row marker column and the column header, before zoom. */
export const MARKER = 44;
export const HEADER = 26;

export type Drafts = Record<number, number>;

export type Offset = { readonly left: number; readonly top: number };

export type Region = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type Starts = { readonly columns: readonly number[]; readonly rows: readonly number[] };

export type Edge = { readonly index: number; readonly x: number };
export type RowEdge = { readonly index: number; readonly y: number };

export type Block = {
  readonly key: string;
  readonly merge: SurfaceMerge;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export const columnWidth = (scene: SurfaceScene, drafts: Drafts, scale: number, index: number): number =>
  Math.round(drafts[index] ?? (scene.columns[index]?.size ?? 0) * scale);

export const rowHeight = (scene: SurfaceScene, drafts: Drafts, scale: number, index: number): number =>
  Math.round(drafts[index] ?? (scene.rows[index]?.size ?? 26) * scale);

/**
 * Where each track starts, before scrolling is taken off.
 *
 * The library's `getBounds` answers for an unscrolled grid, so everything drawn
 * over the canvas is placed from the same track sizes the library is given.
 */
export const startsOf = (
  scene: SurfaceScene,
  columnDrafts: Drafts,
  rowDrafts: Drafts,
  scale: number
): Starts => {
  const columns: number[] = [Math.round(MARKER * scale)];
  for (let index = 0; index < scene.columns.length; index += 1) {
    columns.push(columns[index] + columnWidth(scene, columnDrafts, scale, index));
  }
  const rows: number[] = [Math.round(HEADER * scale)];
  for (let index = 0; index < scene.rows.length; index += 1) {
    rows.push(rows[index] + rowHeight(scene, rowDrafts, scale, index));
  }
  return { columns, rows };
};

export const columnXOf = (
  scene: SurfaceScene,
  starts: Starts,
  offset: Offset,
  index: number
): number => (starts.columns[index] ?? 0) - (index < scene.frozenColumns ? 0 : offset.left);

export const rowYOf = (starts: Starts, offset: Offset, index: number): number =>
  (starts.rows[index] ?? 0) - offset.top;

/**
 * Every visible boundary. The library draws a resize cursor for a column and
 * has no notion of a row height at all, so both handles are ours.
 */
export const edgesOf = (
  scene: SurfaceScene,
  starts: Starts,
  offset: Offset,
  region: Region,
  columnDrafts: Drafts,
  rowDrafts: Drafts,
  scale: number,
  appendAt: number
): { columns: Edge[]; rows: RowEdge[] } => {
  const firstRow = Math.max(0, region.y);
  const firstColumn = Math.max(0, region.x);

  const columns: Edge[] = [];
  const at = (index: number) =>
    columnXOf(scene, starts, offset, index) + columnWidth(scene, columnDrafts, scale, index);
  for (let index = 0; index < Math.min(scene.frozenColumns, appendAt); index += 1) {
    columns.push({ index, x: at(index) });
  }
  for (let index = firstColumn; index < Math.min(firstColumn + region.width + 2, appendAt); index += 1) {
    if (index < scene.frozenColumns) continue;
    columns.push({ index, x: at(index) });
  }

  const rows: RowEdge[] = [];
  const last = Math.min(firstRow + region.height + 2, scene.rows.length);
  for (let index = firstRow; index < last; index += 1) {
    rows.push({
      index,
      y: rowYOf(starts, offset, index) + rowHeight(scene, rowDrafts, scale, index)
    });
  }
  return { columns, rows };
};

/**
 * Where each merged block sits, in the same coordinates as the handles.
 *
 * The inset of one matches the library's own, so the gridlines around a block
 * survive and the ones inside it are covered.
 */
export const blocksOf = (
  scene: SurfaceScene,
  starts: Starts,
  offset: Offset
): Block[] =>
  scene.merges.map((merge) => ({
    key: `${merge.row},${merge.column}`,
    merge,
    x: columnXOf(scene, starts, offset, merge.column) + 1,
    y: rowYOf(starts, offset, merge.row) + 1,
    width:
      (starts.columns[merge.column + merge.columns] ?? 0) - (starts.columns[merge.column] ?? 0) - 1,
    height: (starts.rows[merge.row + merge.rows] ?? 0) - (starts.rows[merge.row] ?? 0) - 1
  }));
