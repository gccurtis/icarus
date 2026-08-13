import { RichContentError } from "#rich-content/errors.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { LinkTarget } from "#rich-content/types/formatting.js";
import type {
  LinkMark,
  RawContent,
  RawMark,
  RawRange
} from "#rich-content/types/raw-content.js";
import {
  intersectRanges,
  rangesOverlap
} from "#rich-content/runtime-api/shared/ranges.js";
import {
  markAfter,
  markBefore
} from "#rich-content/runtime-api/shared/mark-pieces.js";

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
      ...(target.locator === undefined ? {} : { locator: target.locator })
    };
  });
};

export const removeLinksFromRange = (
  content: RawContent,
  range: RawRange,
  ids: RichContentIdFactory
): RawMark[] =>
  content.marks.flatMap((mark): RawMark[] => {
    if (mark.kind !== "link" || !rangesOverlap(content, mark.range, range)) {
      return [mark];
    }
    const overlap = intersectRanges(content, mark.range, range);
    return [
      ...markBefore(content, mark, overlap, () => ids.markId()),
      ...markAfter(content, mark, overlap, () => ids.markId())
    ];
  });

export const setLinkMark = (
  content: RawContent,
  range: RawRange,
  targets: readonly LinkTarget[],
  ids: RichContentIdFactory
): readonly RawMark[] => {
  const mark: LinkMark = {
    id: ids.markId(),
    kind: "link",
    range,
    targets
  };
  return [...removeLinksFromRange(content, range, ids), mark];
};
