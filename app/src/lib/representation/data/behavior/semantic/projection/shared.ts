import type { ContentBlock } from "$representation/data/types/content/content-block";

/**
 * Text that remains author-authored when a structured block is projected.
 * Table bodies stay native; only their declared header rows can enter the exact lane.
 */
export const exactAuthoredTexts = (block: ContentBlock): string[] => {
  if (block.type === "prompt") return [];
  if (block.type === "text" || block.type === "formula") {
    return block.display.trim() ? [block.display.trim()] : [];
  }
  if (block.type === "image") {
    return [
      block.alt.trim(),
      block.caption?.display.trim() ?? ""
    ].filter(Boolean);
  }
  return block.rows
    .slice(0, block.headerRows)
    .flatMap((row) => row.cells.flatMap((cell) => cell.blocks.flatMap(exactAuthoredTexts)));
};

export const narrativeText = (block: ContentBlock): string =>
  exactAuthoredTexts(block).join("\n");

export const authoredImageText = (block: Extract<ContentBlock, { type: "image" }>): string[] =>
  exactAuthoredTexts(block);

export const orderedByFrame = <T extends { frame: { x: number; y: number } }>(
  values: readonly T[]
): readonly T[] =>
  values
    .map((value, order) => ({ value, order }))
    .sort(
      (left, right) =>
        left.value.frame.y - right.value.frame.y ||
        left.value.frame.x - right.value.frame.x ||
        left.order - right.order
    )
    .map(({ value }) => value);
