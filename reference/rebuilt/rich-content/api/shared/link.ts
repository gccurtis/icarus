import { RichContentError } from "$rich-content/errors";
import { markId } from "$rich-content/api/shared/ids";
import { markAfter, markBefore } from "$rich-content/api/shared/mark-pieces";
import { intersectRanges, rangesOverlap } from "$rich-content/api/shared/ranges";
import type { LinkTarget } from "$rich-content/types/formatting";
import type { LinkMark, RawContent, RawMark, RawRange } from "$rich-content/types/raw-content";

/**
 * Admits link targets and copies them.
 *
 * The copy is the point as much as the validation: targets arrive from a caller
 * who still holds the array, and a stored mark that shared it could change under
 * the content. Rebuilding each target field by field also drops anything extra
 * a payload carried, so nothing unvalidated reaches the row.
 */
export const validateAndCopyTargets = (
  targets: readonly LinkTarget[]
): readonly LinkTarget[] => {
  if (targets.length === 0) {
    throw new RichContentError("invalid-link", "At least one link target is required");
  }
  return targets.map((target) => {
    if (target.kind === "url") {
      if (target.href.length === 0) {
        throw new RichContentError("invalid-link", "A URL target needs a non-empty href");
      }
      return { kind: "url", href: target.href };
    }
    if (target.resourceKind.length === 0 || target.resourceId.length === 0) {
      throw new RichContentError(
        "invalid-link",
        "A resource target needs a resource kind and resource ID"
      );
    }
    return {
      kind: "resource",
      resourceKind: target.resourceKind,
      resourceId: target.resourceId,
      // Spread rather than `locator: undefined`, so an absent locator is an
      // absent key in the stored jsonb rather than a null nobody meant.
      ...(target.locator === undefined ? {} : { locator: target.locator })
    };
  });
};

export const removeLinksFromRange = (
  content: RawContent,
  range: RawRange
): RawMark[] =>
  content.marks.flatMap((mark): RawMark[] => {
    if (mark.kind !== "link" || !rangesOverlap(content, mark.range, range)) {
      return [mark];
    }
    const overlap = intersectRanges(content, mark.range, range);
    return [...markBefore(content, mark, overlap), ...markAfter(content, mark, overlap)];
  });

/**
 * Setting a link **replaces** any link already covering the range.
 *
 * Unlike style, links do not layer: text pointing at two places at once is not a
 * thing a reader can act on, so the existing link is cut out first and the new
 * one appended.
 */
export const setLinkMark = (
  content: RawContent,
  range: RawRange,
  targets: readonly LinkTarget[]
): readonly RawMark[] => {
  const mark: LinkMark = { id: markId(), kind: "link", range, targets };
  return [...removeLinksFromRange(content, range), mark];
};
