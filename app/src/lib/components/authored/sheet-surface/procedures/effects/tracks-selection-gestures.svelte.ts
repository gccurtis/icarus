export type SelectionGestureTracking = {
  readonly node: () => HTMLElement | undefined;
  readonly change: () => ((active: boolean) => void) | undefined;
};

/**
 * Name the lifetime of one pointer selection made inside the React grid.
 *
 * Pointer-down precedes the grid's mouse-down selection callback, and the
 * window owns the finish so a drag released beyond the grid still closes. The
 * consumer can consequently distinguish updates within one drag from a later
 * gesture that happens to begin on the same cell.
 */
export const tracksSelectionGestures = (tracking: SelectionGestureTracking): void => {
  $effect(() => {
    const node = tracking.node();
    const change = tracking.change();
    if (node === undefined || change === undefined) return;

    let pointer: number | undefined;

    const finish = () => {
      if (pointer === undefined) return;
      pointer = undefined;
      change(false);
    };

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (pointer !== undefined) finish();
      pointer = event.pointerId;
      change(true);
    };

    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      const ending = event.pointerId;
      // The grid resolves touch selection in its pointer-up handler. Window
      // capture runs before that handler, so close only after this event has
      // crossed the target and every selection callback has been delivered.
      queueMicrotask(() => {
        if (pointer === ending) finish();
      });
    };

    node.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("blur", finish);

    return () => {
      node.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("blur", finish);
      finish();
    };
  });
};
