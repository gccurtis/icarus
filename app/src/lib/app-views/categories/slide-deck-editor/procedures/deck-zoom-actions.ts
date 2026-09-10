import { tick } from "svelte";
import type { DeckActionContext, DeckSelectionActions } from "$app-views/categories/slide-deck-editor/procedures/deck-action-context";
import { boundsOf } from "$app-views/categories/slide-deck-editor/procedures/deck-geometry";
import { placedOn } from "$app-views/categories/slide-deck-editor/procedures/deck-placement";
import { clampZoom } from "$app-views/categories/slide-deck-editor/procedures/stage";

const GUTTER = 24;
const WHEEL_NOTCH = 120;
const PERCENT_PER_NOTCH = 2;

export const createDeckZoomActions = (
  context: DeckActionContext,
  selection: DeckSelectionActions
) => {
  const focusPoint = () => {
    const slide = context.slide;
    if (slide !== undefined && context.selected.length > 0) {
      const held = boundsOf(
        placedOn(slide)
          .filter((placed) => context.selected.includes(placed.element.id))
          .map((placed) => placed.frame)
      );
      return { x: held.x + held.width / 2, y: held.y + held.height / 2 };
    }
    const element = context.held.surface;
    if (element === null || context.size.width === 0) return { x: 0.5, y: 0.5 };
    const x = (element.scrollLeft + element.clientWidth / 2 - GUTTER) / context.size.width;
    const y = (element.scrollTop + element.clientHeight / 2 - GUTTER) / context.size.height;
    return { x: Math.min(Math.max(x, 0), 1), y: Math.min(Math.max(y, 0), 1) };
  };

  const zoomTo = (wanted: number) => {
    const geometry = context.geometry;
    if (geometry === undefined) return;
    const focus = focusPoint();
    context.view.setZoom(clampZoom(wanted, geometry));
    void tick().then(() => {
      const element = context.held.surface;
      if (element === null) return;
      element.scrollTo({
        left: Math.max(0, GUTTER + focus.x * context.size.width - element.clientWidth / 2),
        top: Math.max(0, GUTTER + focus.y * context.size.height - element.clientHeight / 2)
      });
    });
  };

  return {
    zoomTo,
    pinch: (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo((context.view.zoom ?? 100) - (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH);
    },
    zoomBy: (direction: 1 | -1) => {
      if (context.geometry !== undefined) {
        zoomTo((context.view.zoom ?? 100) + direction * context.geometry.zoomStep);
      }
    },
    step: (direction: 1 | -1) => {
      const next = context.body?.slides[context.index + direction];
      if (next !== undefined) selection.show(next.id);
    }
  };
};
