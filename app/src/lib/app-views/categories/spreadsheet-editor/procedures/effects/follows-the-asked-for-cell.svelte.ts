export type Asked = {
  readonly scrollTo: () => { readonly taken: () => void; readonly reach: () => void } | undefined;
  readonly focused: () => (() => void) | undefined;
};

/**
 * Two ways a cell is asked for from outside the grid: the runtime asking to be
 * scrolled to one, and a tab opening on one.
 *
 * Both are requests rather than state, so each is taken as it is answered — the
 * runtime's field is cleared and the tab's focus is remembered — or the same
 * cell would be reached for on every pass.
 */
export const followsTheAskedForCell = (asked: Asked): void => {
  $effect(() => {
    const request = asked.scrollTo();
    if (request === undefined) return;

    request.reach();
    request.taken();
  });

  $effect(() => {
    const landing = asked.focused();
    if (landing === undefined) return;

    landing();
  });
};
