import type { Signal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";

export type Settling = {
  readonly unset: () => boolean;
  readonly whole: () => void;
  readonly collapsed: () => Signal | undefined;
  readonly show: (signal: Signal) => void;
};

/**
 * What the panel shows when the reader has not chosen anything, and when what
 * they chose is one cell wearing a range's clothes.
 *
 * A merged block is selected as the rectangle it covers — the library reports
 * the row a click landed on rather than the block — and the panel that answers
 * for it is the cell's, so the range collapses to the block's own cell before
 * a lens is picked.
 */
export const settlesTheInspector = (settling: Settling): void => {
  $effect(() => {
    if (settling.unset()) settling.whole();
  });

  $effect(() => {
    const signal = settling.collapsed();
    if (signal !== undefined) settling.show(signal);
  });
};
