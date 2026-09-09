import {
  arm,
  disarm,
  drafting,
  writingBegun,
  writingTaken,
  type Picker
} from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";

export type WritingSession = {
  readonly picker: Picker;
  readonly picking: () => boolean;
  readonly address: () => string | undefined;
  readonly draft: () => string;
  readonly selected: () => unknown;
  readonly abandon: () => void;
  readonly begin: (seed: string) => void;
};

/**
 * One cell being written, wherever the field showing it happens to be.
 *
 * Four arrangements hold at once while somebody types: the session ends when
 * the selection moves, the grid is armed to answer a click with a reference,
 * the draft is published so the grid can draw it, and a keystroke on the grid
 * opens the field here. They are one session rather than four because each
 * begins and ends with the same edit.
 */
export const runsTheWritingSession = (session: WritingSession): void => {
  $effect(() => {
    session.selected();
    session.abandon();
  });

  $effect(() => {
    if (session.picking()) arm(session.picker);
    else disarm(session.picker);
    return () => disarm(session.picker);
  });

  $effect(() => {
    const at = session.address();
    drafting(at === undefined ? undefined : { at, text: session.draft() });
    return () => drafting(undefined);
  });

  $effect(() => {
    const wanted = writingBegun();
    if (wanted === undefined) return;

    writingTaken();
    session.begin(wanted.seed);
  });
};
