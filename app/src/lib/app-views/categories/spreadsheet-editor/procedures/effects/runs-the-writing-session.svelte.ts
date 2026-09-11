import type { PickingChannel, Picker, Writer } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";

export type WritingSession = {
  readonly channel: PickingChannel;
  readonly picker: Picker;
  readonly picking: () => boolean;
  readonly address: () => string | undefined;
  readonly targets: () => readonly string[];
  readonly draft: () => string;
  readonly selected: () => unknown;
  readonly commit: () => void;
  readonly cancel: () => void;
  readonly begin: (seed: string) => void;
};

/**
 * One captured selection being written, wherever the field showing it happens to be.
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
    session.cancel();
  });

  $effect(() => {
    if (session.picking()) channel.arm(session.picker);
    else channel.disarm(session.picker);
    return () => channel.disarm(session.picker);
  });

  $effect(() => {
    const at = session.address();
    channel.drafting(at === undefined ? undefined : { at, targets: session.targets(), text: session.draft() });
    return () => channel.drafting(undefined);
  });

  $effect(() => {
    const writer: Writer = { begin: session.begin, commit: session.commit };
    channel.writeWith(writer);
    return () => {
      session.cancel();
      channel.stopWritingWith(writer);
    };
  });
};
