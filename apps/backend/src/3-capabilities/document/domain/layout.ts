import type {
  DocumentPageLayout,
  DocumentRow
} from "./model.js";

/** Horizontal space available to Document Rows after the page margins. */
export const computeUsablePageWidth = (
  layout: DocumentPageLayout
): number => layout.page.widthTwips - layout.margins.leftTwips - layout.margins.rightTwips;

/** Vertical space available to the authored flow after the page margins. */
export const computeUsablePageHeight = (
  layout: DocumentPageLayout
): number => layout.page.heightTwips - layout.margins.topTwips - layout.margins.bottomTwips;

/**
 * Resolve one Block's horizontal share inside a known container.
 *
 * Row gaps are removed before the positive track units divide the remaining
 * width. The function expects a structurally valid Row and rejects impossible
 * geometry rather than returning a misleading negative or non-finite width.
 */
export const computeAssignedBlockWidth = (
  row: DocumentRow,
  blockId: string,
  usableContainerWidthTwips: number
): number => {
  if (!Number.isFinite(usableContainerWidthTwips) || usableContainerWidthTwips <= 0) {
    throw new RangeError("The usable container width must be positive and finite");
  }

  const blockIndex = row.blocks.findIndex((block) => block.id === blockId);
  if (blockIndex < 0) {
    throw new RangeError(`Block is not in Row ${row.id}: ${blockId}`);
  }

  const track = row.layout.tracks[blockIndex];
  if (track?.blockId !== blockId) {
    throw new RangeError(`Row ${row.id} tracks do not match Block order`);
  }

  let totalWidthUnits = 0;
  for (const candidate of row.layout.tracks) {
    if (!Number.isSafeInteger(candidate.widthUnits) || candidate.widthUnits <= 0) {
      throw new RangeError(`Row ${row.id} track widths must be positive integers`);
    }
    totalWidthUnits += candidate.widthUnits;
  }
  if (!Number.isSafeInteger(totalWidthUnits) || totalWidthUnits <= 0) {
    throw new RangeError(`Row ${row.id} total track width is not a safe integer`);
  }

  if (!Number.isSafeInteger(row.layout.blockGapTwips) || row.layout.blockGapTwips < 0) {
    throw new RangeError(`Row ${row.id} Block gap must be a non-negative integer`);
  }
  const totalGapTwips = row.layout.blockGapTwips * Math.max(0, row.blocks.length - 1);
  if (!Number.isSafeInteger(totalGapTwips) || totalGapTwips >= usableContainerWidthTwips) {
    throw new RangeError(`Row ${row.id} Block gaps must leave positive container width`);
  }

  return (usableContainerWidthTwips - totalGapTwips) *
    (track.widthUnits / totalWidthUnits);
};
