import type { PickingChannel, Picker } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";

export type WritingSession = {
  readonly channel: PickingChannel;
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
  const { channel } = session;

  $effect(() => {
    session.selected();
    session.abandon();
  });

  $effect(() => {
    if (session.picking()) channel.arm(session.picker);
    else channel.disarm(session.picker);
    return () => channel.disarm(session.picker);
  });

  $effect(() => {
    const at = session.address();
    channel.drafting(at === undefined ? undefined : { at, text: session.draft() });
    return () => channel.drafting(undefined);
  });

  $effect(() => {
    const wanted = channel.begun;
    if (wanted === undefined) return;

    channel.writingTaken();
    session.begin(wanted.seed);
  });
};
