import type { DeckActionContext } from "$app-views/categories/slide-deck-editor/procedures/deck-action-context";
import { holderOn } from "$app-views/categories/slide-deck-editor/procedures/deck-reading";
import { rangeOf } from "$app-views/categories/slide-deck-editor/procedures/selecting";

/** Owns the browser and selection synchronization of one mounted deck surface. */
export const mountsDeckSurface = (context: DeckActionContext): void => {
  $effect(() => {
    const element = context.held.surface;
    if (element === null) return;
    const measure = () => {
      context.held.available = { width: element.clientWidth, height: element.clientHeight };
    };
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    measure();
    return () => watcher.disconnect();
  });

  $effect(() => {
    const id = context.slide?.id;
    if (id === context.held.shownSlide) return;
    context.held.shownSlide = id;
    context.held.editing = undefined;
  });

  $effect(() => {
    const range = rangeOf(context.view.selection);
    const slide = context.slide;
    if (range === undefined || context.body === undefined || slide === undefined) return;
    if (context.held.editing === range.blockId) return;
    if (holderOn(slide, range.blockId) !== undefined) context.held.editing = range.blockId;
  });
};
