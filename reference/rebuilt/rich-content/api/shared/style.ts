import { RichContentError } from "$rich-content/errors";
import { markId } from "$rich-content/api/shared/ids";
import { markAfter, markBefore } from "$rich-content/api/shared/mark-pieces";
import { intersectRanges, rangesOverlap } from "$rich-content/api/shared/ranges";
import type { StyleProperties } from "$rich-content/types/formatting";
import type { RawContent, RawMark, RawRange, StyleMark } from "$rich-content/types/raw-content";

const STYLE_KEYS = new Set<keyof StyleProperties>([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "color",
  "backgroundColor",
  "letterSpacing",
  "lineHeight"
]);

const BOOLEAN_KEYS = ["bold", "italic", "underline", "strike", "code"];
const NUMBER_KEYS = ["fontSize", "fontWeight", "letterSpacing", "lineHeight"];

/**
 * Admits a style, and returns only the properties actually set.
 *
 * Dropping `undefined` entries matters: `{ bold: undefined }` from a caller
 * spreading an object would otherwise store a property that claims to say
 * something and says nothing, and `render-display` would have to decide what it
 * meant.
 */
export const validateStyle = (properties: StyleProperties): StyleProperties => {
  const entries = Object.entries(properties).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    throw new RichContentError("invalid-style", "At least one style property is required");
  }
  for (const [key, value] of entries) {
    if (!STYLE_KEYS.has(key as keyof StyleProperties)) {
      throw new RichContentError("invalid-style", `Unknown style property '${key}'`);
    }
    const expectsBoolean = BOOLEAN_KEYS.includes(key);
    const expectsNumber = NUMBER_KEYS.includes(key);
    if (
      (expectsBoolean && typeof value !== "boolean") ||
      (expectsNumber && (typeof value !== "number" || !Number.isFinite(value))) ||
      (!expectsBoolean && !expectsNumber && typeof value !== "string")
    ) {
      throw new RichContentError("invalid-style", `Style property '${key}' has an invalid value`);
    }
  }
  return Object.fromEntries(entries) as StyleProperties;
};

/**
 * Applying a style appends a mark rather than merging with what is there.
 *
 * Later marks win at render time, so appending is how the most recent
 * instruction takes effect — and it keeps the earlier one intact underneath,
 * which is what makes removing the newer style reveal the older rather than
 * leaving unstyled text.
 */
export const addStyleMark = (
  marks: readonly RawMark[],
  range: RawRange,
  properties: StyleProperties
): readonly RawMark[] => [
  ...marks,
  { id: markId(), kind: "style", range, properties } satisfies StyleMark
];

/**
 * Removes named properties across a range, splitting each affected mark into the
 * part before, the reduced part, and the part after.
 *
 * A mark whose properties are *all* removed disappears entirely rather than
 * lingering as an empty one — an empty style mark is indistinguishable in effect
 * and would accumulate with every edit.
 */
export const removeStyleProperties = (
  content: RawContent,
  range: RawRange,
  properties: readonly (keyof StyleProperties)[]
): readonly RawMark[] => {
  if (properties.length === 0 || properties.some((key) => !STYLE_KEYS.has(key))) {
    throw new RichContentError("invalid-style", "Style removal requires known properties");
  }
  const keys = new Set(properties);
  return content.marks.flatMap((mark): RawMark[] => {
    if (mark.kind !== "style" || !rangesOverlap(content, mark.range, range)) {
      return [mark];
    }
    const remaining = Object.fromEntries(
      Object.entries(mark.properties).filter(([key]) => !keys.has(key as keyof StyleProperties))
    ) as StyleProperties;
    const overlap = intersectRanges(content, mark.range, range);
    return [
      ...markBefore(content, mark, overlap),
      ...(Object.keys(remaining).length === 0
        ? []
        : [{ ...mark, id: markId(), range: overlap, properties: remaining }]),
      ...markAfter(content, mark, overlap)
    ];
  });
};
