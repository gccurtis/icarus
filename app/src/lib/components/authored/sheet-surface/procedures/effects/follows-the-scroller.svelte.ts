import type { SurfaceHeld } from "$authored-components/sheet-surface/sheet-surface.state.svelte";

/**
 * How far the grid has been scrolled, read from the element that scrolls.
 *
 * `getBounds` answers for an unscrolled grid, so anything drawn over the canvas
 * has to work its position out from the tracks the library already holds. This
 * is that source, and it is re-found whenever the visible region or the size
 * changes because the library replaces the element underneath.
 */
export const followsTheScroller = (held: SurfaceHeld): void => {
  $effect(() => {
    void held.region;
    void held.size;

    const node = held.host?.querySelector(".dvn-scroller");
    if (!(node instanceof HTMLElement)) return;

    const read = () => {
      if (node.scrollLeft !== held.offset.left || node.scrollTop !== held.offset.top) {
        held.offset = { left: node.scrollLeft, top: node.scrollTop };
      }
    };
    read();

    node.addEventListener("scroll", read, { passive: true });
    return () => node.removeEventListener("scroll", read);
  });
};
