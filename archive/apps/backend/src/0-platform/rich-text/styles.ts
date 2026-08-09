// Style utilities — overlay helper and mark-to-properties mapping.

import type { RichTextMark, TextStyleProperties } from "./types.js";

/**
 * Apply overlay onto base. For each property in `over` that is not
 * `undefined`, replace the corresponding value in `base`. Returns a new
 * object — neither argument is mutated.
 */
export function overlay(
  base: TextStyleProperties,
  over: TextStyleProperties,
): TextStyleProperties {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(over) as (keyof TextStyleProperties)[]) {
    const v = over[key];
    if (v !== undefined) {
      result[key] = v;
    }
  }
  return result as TextStyleProperties;
}

/**
 * Translate a mark into its equivalent `TextStyleProperties`.
 * Used during `overlayMarks` and `resolveStyling`.
 */
export function markToProperties(mark: RichTextMark): TextStyleProperties {
  switch (mark.kind) {
    case "bold":
      return { fontWeight: 700 };
    case "italic":
      return { italic: true };
    case "underline":
      return { underline: true };
    case "strike":
      return { strike: true };
    case "code":
      return { code: true, fontFamily: "monospace" };
    case "style":
      return mark.properties;
    case "link":
      // links don't affect visual style
      return {};
  }
}

/**
 * Deep-merge two `TextStyleProperties` with `authoritative` winning on
 * conflicts.  Uses the same `overlay` semantics: a property in
 * `authoritative` that is not `undefined` replaces the corresponding
 * property in `supplementary`.
 */
export function mergeStyleProperties(
  authoritative: TextStyleProperties,
  supplementary: TextStyleProperties,
): TextStyleProperties {
  return overlay(supplementary, authoritative);
}