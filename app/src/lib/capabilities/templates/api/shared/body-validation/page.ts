import {
  type Fields,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  isText,
  validInteger
} from "$capabilities/templates/api/shared/body-validation/primitives";

const PAPER_DIMENSIONS: Readonly<Record<string, readonly [number, number]>> = {
  letter: [8.5, 11],
  legal: [8.5, 14],
  tabloid: [11, 17],
  a3: [11.69, 16.54],
  a4: [8.27, 11.69],
  a5: [5.83, 8.27]
};

export const validPage = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["paper", "orientation", "margins"]) ||
    !isRecord(value.margins) ||
    !hasOnlyKeys(value.margins, ["top", "right", "bottom", "left"]) ||
    Object.keys(value.margins).length !== 4
  ) {
    return false;
  }
  const margins = value.margins;
  const paper = value.paper;
  const validPaper =
    (isText(paper) && ["letter", "legal", "tabloid", "a3", "a4", "a5"].includes(paper)) ||
    (isRecord(paper) &&
      hasOnlyKeys(paper, ["width", "height"]) &&
      Object.keys(paper).length === 2 &&
      isFiniteNumber(paper.width) &&
      paper.width > 0 &&
      paper.width <= 1_000 &&
      isFiniteNumber(paper.height) &&
      paper.height > 0 &&
      paper.height <= 1_000);
  if (
    !validPaper ||
    (value.orientation !== "portrait" && value.orientation !== "landscape") ||
    !["top", "right", "bottom", "left"].every(
      (key) =>
        isFiniteNumber(margins[key]) &&
        (margins[key] as number) >= 0 &&
        (margins[key] as number) <= 100
    )
  ) {
    return false;
  }
  const portrait = isText(paper)
    ? PAPER_DIMENSIONS[paper]
    : ([paper.width as number, paper.height as number] as const);
  const [width, height] =
    value.orientation === "portrait" ? portrait : ([portrait[1], portrait[0]] as const);
  return (
    (margins.left as number) + (margins.right as number) < width &&
    (margins.top as number) + (margins.bottom as number) < height
  );
};
