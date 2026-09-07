import type { Mark, MarkStyle } from "$representation/data/types/content/content-block";
import { cellMarkEnd, cellOffsetOf } from "$representation/data/behavior/spreadsheets/cell-marks";

export type { Mark, MarkStyle } from "$representation/data/types/content/content-block";

export const STYLES: readonly { value: MarkStyle; label: string }[] = [
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "underline", label: "Underline" },
  { value: "strikethrough", label: "Strikethrough" }
];

export const isMarkStyle = (value: string): value is MarkStyle => STYLES.some((mark) => mark.value === value);

export const startOf = (mark: Mark): number => cellOffsetOf(mark.from);

export const endOf = (mark: Mark): number => cellOffsetOf(mark.to);

export const spanOf = (from: number, to: number): Pick<Mark, "from" | "to"> => ({
  from: cellMarkEnd(from),
  to: cellMarkEnd(to)
});

export const covers = (mark: Mark, from: number, to: number): boolean =>
  startOf(mark) <= from && endOf(mark) >= to;

export const exactly = (mark: Mark, from: number, to: number): boolean =>
  startOf(mark) === from && endOf(mark) === to;
