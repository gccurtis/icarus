import type { StyleSet, TextStyle } from "$representation/data/types/documents/style-set";

/**
 * Document leading is stored as absolute CSS pixels. Early document templates
 * accidentally used the deck's unitless ratio convention; values in the
 * ratio-sized range are converted at the document boundary so existing bodies
 * remain readable without mutating their persisted history.
 */
const LEGACY_RATIO_CEILING = 4;

const precise = (value: number): number => Math.round(value * 100) / 100;

export const documentLineHeightPx = (
  fontSize: number,
  lineHeight: number | undefined
): number | undefined => {
  if (lineHeight === undefined) return undefined;
  return lineHeight <= LEGACY_RATIO_CEILING
    ? precise(fontSize * lineHeight)
    : lineHeight;
};

export const normalizeDocumentTextStyle = (style: TextStyle): TextStyle => {
  const lineHeight = documentLineHeightPx(style.fontSize ?? 16, style.lineHeight);
  return lineHeight === style.lineHeight ? style : { ...style, lineHeight };
};

export const normalizeDocumentStyleSet = (set: StyleSet): StyleSet => {
  let changed = false;
  const styles = Object.fromEntries(
    Object.entries(set.styles).map(([key, style]) => {
      const normalized = normalizeDocumentTextStyle(style);
      if (normalized !== style) changed = true;
      return [key, normalized];
    })
  );

  return changed ? { ...set, styles } : set;
};
