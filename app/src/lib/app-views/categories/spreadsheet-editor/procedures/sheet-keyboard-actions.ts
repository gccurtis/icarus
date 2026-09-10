import type { SheetActionContext } from "$app-views/categories/spreadsheet-editor/procedures/sheet-action-context";

const WHEEL_NOTCH = 120;
const PERCENT_PER_NOTCH = 2;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

const clampZoom = (value: number): number =>
  Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));

export const createSheetKeyboardActions = (context: SheetActionContext) => ({
  pinch: (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    context.view.setZoom(
      clampZoom(context.zoom - (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH)
    );
  },
  keydown: (event: KeyboardEvent) => {
    const element = context.held.wrapper;
    if (element === undefined || !(event.target instanceof Node) || !element.contains(event.target)) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      context.runtime?.undo();
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      context.runtime?.redo();
    }
  }
});
