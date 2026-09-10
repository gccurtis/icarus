import {
  collectBlockIdentifiers,
  validBlock
} from "$capabilities/templates/api/shared/body-validation/blocks";
import {
  type Fields,
  addUniqueIdentifier,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  isText,
  validIdentifier,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";

export const validFrame = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["x", "y", "width", "height"]) &&
  Object.keys(value).length === 4 &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height);

export const validSlideBackground = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.kind === "color") {
    return hasOnlyKeys(value, ["kind", "color"]) && validText(value.color, 1_000);
  }
  return (
    value.kind === "image" &&
    hasOnlyKeys(value, ["kind", "fileId", "fit"]) &&
    validIdentifier(value.fileId) &&
    (value.fit === "cover" || value.fit === "contain")
  );
};

const validPoint = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["x", "y"]) &&
  Object.keys(value).length === 2 &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y);

const validElementPaint = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["fill", "stroke", "opacity", "cornerRadius", "shadow"])
  ) {
    return false;
  }
  if (value.fill !== undefined && !validText(value.fill, 1_000)) return false;
  if (value.stroke !== undefined) {
    if (
      !isRecord(value.stroke) ||
      !hasOnlyKeys(value.stroke, ["color", "width", "dash"]) ||
      !validText(value.stroke.color, 1_000) ||
      !isFiniteNumber(value.stroke.width) ||
      value.stroke.width < 0 ||
      value.stroke.width > 1_000 ||
      (value.stroke.dash !== undefined &&
        !["solid", "dashed", "dotted"].includes(value.stroke.dash as string))
    ) {
      return false;
    }
  }
  if (
    value.opacity !== undefined &&
    (!isFiniteNumber(value.opacity) || value.opacity < 0 || value.opacity > 1)
  ) {
    return false;
  }
  if (
    value.cornerRadius !== undefined &&
    (!isFiniteNumber(value.cornerRadius) || value.cornerRadius < 0 || value.cornerRadius > 10_000)
  ) {
    return false;
  }
  if (value.shadow !== undefined) {
    if (
      !isRecord(value.shadow) ||
      !hasOnlyKeys(value.shadow, ["color", "x", "y", "blur"]) ||
      !validText(value.shadow.color, 1_000) ||
      !isFiniteNumber(value.shadow.x) ||
      Math.abs(value.shadow.x) > 10_000 ||
      !isFiniteNumber(value.shadow.y) ||
      Math.abs(value.shadow.y) > 10_000 ||
      !isFiniteNumber(value.shadow.blur) ||
      value.shadow.blur < 0 ||
      value.shadow.blur > 10_000
    ) {
      return false;
    }
  }
  return true;
};

const validBlockOfType = (value: unknown, type: string): boolean =>
  isRecord(value) && value.type === type && validBlock(value);

const validLineEnds = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["start", "end"]) &&
  [value.start, value.end].every(
    (end) => end === undefined || ["none", "arrow", "dot"].includes(end as string)
  );

function validElementContent(value: unknown, depth: number): boolean {
  if (!isRecord(value) || depth > 12 || !isText(value.type)) return false;
  if (
    value.type === "text" ||
    value.type === "formula" ||
    value.type === "prompt" ||
    value.type === "image"
  ) {
    return (
      hasOnlyKeys(value, ["type", "block"]) &&
      validBlockOfType(value.block, value.type)
    );
  }
  if (value.type === "shape") {
    return (
      hasOnlyKeys(value, ["type", "shape", "block"]) &&
      ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"].includes(
        value.shape as string
      ) &&
      (value.block === undefined || validBlockOfType(value.block, "text"))
    );
  }
  if (value.type === "line") {
    return (
      hasOnlyKeys(value, ["type", "from", "to", "ends"]) &&
      validPoint(value.from) &&
      validPoint(value.to) &&
      (value.ends === undefined || validLineEnds(value.ends))
    );
  }
  if (value.type === "table") {
    return (
      hasOnlyKeys(value, ["type", "block", "rowHeights"]) &&
      validBlockOfType(value.block, "table") &&
      (value.rowHeights === undefined ||
        (Array.isArray(value.rowHeights) &&
          value.rowHeights.length <= 1_000 &&
          value.rowHeights.every(
            (height) => isFiniteNumber(height) && height > 0 && height <= 10_000
          )))
    );
  }
  if (value.type === "chart") {
    return hasOnlyKeys(value, ["type", "spec"]) && isRecord(value.spec);
  }
  return (
    value.type === "group" &&
    hasOnlyKeys(value, ["type", "children"]) &&
    Array.isArray(value.children) &&
    value.children.length <= 2_000 &&
    value.children.every((child) => validSlideElement(child, depth + 1))
  );
}

export function validSlideElement(value: unknown, depth = 0): boolean {
  return (
    depth <= 12 &&
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "frame",
      "rotation",
      "overflow",
      "paint",
      "locked",
      "fromPlaceholder",
      "content"
    ]) &&
    validIdentifier(value.id) &&
    validFrame(value.frame) &&
    (value.rotation === undefined ||
      (isFiniteNumber(value.rotation) && value.rotation >= -36_000 && value.rotation <= 36_000)) &&
    (value.overflow === undefined || ["clip", "shrink", "grow"].includes(value.overflow as string)) &&
    (value.paint === undefined || validElementPaint(value.paint)) &&
    (value.locked === undefined || typeof value.locked === "boolean") &&
    (value.fromPlaceholder === undefined || validIdentifier(value.fromPlaceholder)) &&
    validElementContent(value.content, depth)
  );
}

export const collectSlideElementIdentifiers = (value: Fields, seen: Set<string>): boolean => {
  if (!addUniqueIdentifier(seen, value.id) || !isRecord(value.content)) return false;
  const content = value.content;
  if (["text", "formula", "prompt", "image", "table"].includes(content.type as string)) {
    return collectBlockIdentifiers(content.block as Fields, seen);
  }
  if (content.type === "shape" && isRecord(content.block)) {
    return collectBlockIdentifiers(content.block, seen);
  }
  if (content.type === "group") {
    return (content.children as Fields[]).every((child) =>
      collectSlideElementIdentifiers(child, seen)
    );
  }
  return true;
};

export const slideElementsUseOnlyRoles = (
  elements: unknown[],
  roles: ReadonlySet<string>
): boolean =>
  elements.every((element) => {
    if (!isRecord(element) || !isRecord(element.content)) return false;
    if (
      element.fromPlaceholder !== undefined &&
      !roles.has(element.fromPlaceholder as string)
    ) {
      return false;
    }
    return (
      element.content.type !== "group" ||
      slideElementsUseOnlyRoles(element.content.children as unknown[], roles)
    );
  });

const validAspectRatio = (value: unknown): boolean => {
  if (!isText(value) || !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)) return false;
  const [width, height] = value.split(":").map(Number);
  return width > 0 && width <= 10_000 && height > 0 && height <= 10_000;
};
