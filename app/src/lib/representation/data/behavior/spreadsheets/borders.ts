import type {
  BorderSide,
  CellBorder
} from "$representation/data/types/spreadsheets/cell-format";

export const BORDER_SIDES: readonly BorderSide[] = ["top", "right", "bottom", "left"];

export const hasBorder = (border: CellBorder | undefined): boolean =>
  border !== undefined && BORDER_SIDES.some((side) => border[side] !== undefined);
