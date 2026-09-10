import type { SurfacePoint } from "$authored-components/slide-surface";
import type {
  DeckActionContext,
  DeckSelectionActions
} from "$app-views/categories/slide-deck-editor/procedures/deck-action-context";
import {
  insertedElement,
  type InsertEntry,
  type PlacedKind
} from "$app-views/categories/slide-deck-editor/procedures/inserting";
import { elementsSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";

export const createDeckInsertActions = (
  context: DeckActionContext,
  selection: DeckSelectionActions
) => {
  const put = (kind: PlacedKind, at: SurfacePoint | undefined) => {
    const body = context.body;
    const slide = context.slide;
    if (body === undefined || slide === undefined) return;
    const { element, edit } = insertedElement(kind, body, slide.id, at);
    if (edit.ops.length === 0) return;
    context.held.editing = undefined;
    selection.apply(edit.ops);
    const signal = elementsSignal([element]);
    if (signal !== undefined) context.view.inspect(signal.key, signal.selection);
  };

  return {
    pointedAt: (at: SurfacePoint) => {
      context.held.pointed = at;
      context.held.onSlide = true;
    },
    armMenu: () => {
      context.held.insertAt = context.held.onSlide ? context.held.pointed : undefined;
      context.held.onSlide = false;
    },
    insert: (entry: InsertEntry) => {
      if (entry.ready) put(entry.kind as PlacedKind, context.held.insertAt);
    }
  };
};
