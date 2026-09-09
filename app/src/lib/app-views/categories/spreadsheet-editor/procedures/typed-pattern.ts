import { PLAIN, patternOf } from "$app-views/categories/spreadsheet-editor/procedures/number-format";

const TYPED = /^(-?)([$€£¥]?)([\d,]+)(?:\.(\d+))?$/;

/** Preserve visible number-format intent that cannot be recovered from the value. */
export const patternTyped = (text: string, value: number): string | null => {
  const match = TYPED.exec(text.trim());
  if (match === null) return null;
  const [, , prefix, whole, fraction] = match;
  const figures = fraction?.length ?? 0;
  const natural = (String(Math.abs(value)).split(".")[1] ?? "").length;
  const thousands = whole.includes(",") ? "," : "none";
  if (figures <= natural && prefix === "" && thousands === "none") return null;
  return patternOf({ ...PLAIN, prefix, decimals: Math.max(figures, natural), thousands });
};
