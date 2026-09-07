import type {
  Border,
  BorderLine,
  BorderSide
} from "$representation/data/types/content/block-format";

export const BORDER_SIDES: readonly BorderSide[] = ["top", "right", "bottom", "left"];

export const boxLineOf = (border: Border | undefined): BorderLine | undefined =>
  border === undefined ? undefined : (border.top ?? border.right ?? border.bottom ?? border.left);

export const boxedBorder = (line: BorderLine): Border => ({ top: line, right: line, bottom: line, left: line });

export const hasBorder = (border: Border | undefined): boolean =>
  border !== undefined && BORDER_SIDES.some((side) => border[side] !== undefined);
