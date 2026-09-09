import { endingTaken, writingEnded } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";

/**
 * The grid takes the caret back when writing ended at the keyboard.
 *
 * Only Enter and Escape say so. A click into another field ends the writing
 * too, and the caret belongs where the reader just put it.
 */
export const takesBackTheCaret = (focus: () => void): void => {
  $effect(() => {
    if (writingEnded() === undefined) return;

    endingTaken();
    focus();
  });
};
