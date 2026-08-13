import { RichContentError } from "#rich-content/errors.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { StyleProperties } from "#rich-content/types/formatting.js";
import type {
  RawContent,
  RawMark,
  RawRange,
  StyleMark
} from "#rich-content/types/raw-content.js";
import {
  intersectRanges,
  rangesOverlap
} from "#rich-content/runtime-api/shared/ranges.js";
import {
  markAfter,
  markBefore
} from "#rich-content/runtime-api/shared/mark-pieces.js";

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

export const validateStyle = (properties: StyleProperties): StyleProperties => {
  const entries = Object.entries(properties).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    throw new RichContentError("invalid-style", "At least one style property is required");
  }
  for (const [key, value] of entries) {
    if (!STYLE_KEYS.has(key as keyof StyleProperties)) {
      throw new RichContentError("invalid-style", `Unknown style property '${key}'`);
    }
    const expectsBoolean = ["bold", "italic", "underline", "strike", "code"].includes(key);
    const expectsNumber = ["fontSize", "fontWeight", "letterSpacing", "lineHeight"].includes(key);
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

export const addStyleMark = (
  marks: readonly RawMark[],
  range: RawRange,
  properties: StyleProperties,
  ids: RichContentIdFactory
): readonly RawMark[] => [
  ...marks,
  { id: ids.markId(), kind: "style", range, properties } satisfies StyleMark
];

export const removeStyleProperties = (
  content: RawContent,
  range: RawRange,
  properties: readonly (keyof StyleProperties)[],
  ids: RichContentIdFactory
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
      Object.entries(mark.properties).filter(([key]) =>
        !keys.has(key as keyof StyleProperties)
      )
    ) as StyleProperties;
    const overlap = intersectRanges(content, mark.range, range);
    return [
      ...markBefore(content, mark, overlap, () => ids.markId()),
      ...(Object.keys(remaining).length === 0
        ? []
        : [{ ...mark, id: ids.markId(), range: overlap, properties: remaining }]),
      ...markAfter(content, mark, overlap, () => ids.markId())
    ];
  });
};
