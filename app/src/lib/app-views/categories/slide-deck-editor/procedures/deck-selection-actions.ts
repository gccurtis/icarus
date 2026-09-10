import type {
  DeckActionContext,
  DeckSelectionActions
} from "$app-views/categories/slide-deck-editor/procedures/deck-action-context";
import { emptyText } from "$app-views/categories/slide-deck-editor/procedures/deck-elements";
import { elementIn, holderOn, textOf, blockIn } from "$app-views/categories/slide-deck-editor/procedures/deck-reading";
import { withSet } from "$app-views/categories/slide-deck-editor/procedures/deck-values";
import {
  cellsSignal,
  elementsSignal,
  sameSelection,
  slideSignal,
  textSignal,
  threadsSignal
} from "$app-views/categories/slide-deck-editor/procedures/selecting";
import { replaced } from "$app-views/categories/slide-deck-editor/procedures/typing";

export const createDeckSelectionActions = (context: DeckActionContext): DeckSelectionActions => {
  const apply: DeckSelectionActions["apply"] = (ops) => {
    if (ops.length > 0) context.runtime?.apply(ops);
  };

  const show = (slideId: string) => {
    if (context.deckId === undefined) return;
    context.held.editing = undefined;
    context.view.open({ category: "slide-deck-editor", resourceId: context.deckId, focus: slideId });
    context.view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection);
  };

  const select = (ids: string[]) => {
    const body = context.body;
    if (body === undefined) return;
    context.held.editing = undefined;
    const elements = ids.flatMap((id) => {
      const element = elementIn(body, id);
      return element === undefined ? [] : [element];
    });
    const signal = elementsSignal(elements);
    if (signal !== undefined) context.view.inspect(signal.key, signal.selection);
  };

  const clear = () => {
    context.held.editing = undefined;
    const slide = context.slide;
    if (slide === undefined) context.view.clear();
    else context.view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection);
  };

  const enter = (id: string, blockId: string) => {
    const body = context.body;
    if (body === undefined) return;
    const block = blockIn(body, blockId);
    if (block === undefined) return;
    if (!context.selected.includes(id)) select([id]);
    context.held.editing = blockId;
    const signal = textSignal(blockId, block.display.length, block.display.length);
    context.view.inspect(signal.key, signal.selection);
  };

  const startTyping = (elementId: string, typed: string) => {
    const body = context.body;
    if (body === undefined) return;
    const element = elementIn(body, elementId);
    if (element === undefined) return;
    const block = textOf(element);
    if (block === undefined) {
      const made = emptyText(body.styles.defaultKey, typed);
      apply(withSet(body, "element", `${element.id}/content/block`, made).ops);
      context.held.editing = made.id;
      const signal = textSignal(made.id, typed.length, typed.length);
      context.view.inspect(signal.key, signal.selection);
      return;
    }
    const at = block.display.length;
    if (typed !== "") apply(replaced(block, at, at, typed));
    context.held.editing = block.id;
    const signal = textSignal(block.id, at + typed.length, at + typed.length);
    context.view.inspect(signal.key, signal.selection);
  };

  return {
    apply,
    show,
    select,
    pickCells: (tableId, ids) => {
      context.held.editing = undefined;
      const signal = cellsSignal(tableId, ids);
      context.view.inspect(signal.key, signal.selection);
    },
    clear,
    enter,
    startTyping,
    exit: () => {
      const editing = context.held.editing;
      if (editing === undefined) return;
      const holder = context.slide === undefined ? undefined : holderOn(context.slide, editing)?.id;
      context.held.editing = undefined;
      if (holder !== undefined) select([holder]);
      else if (context.selected.length > 0) select([...context.selected]);
      else clear();
    },
    edited: (change) => {
      const body = context.body;
      if (body === undefined) return;
      const block = blockIn(body, change.blockId);
      if (block !== undefined) apply(replaced(block, change.from, change.to, change.insert));
    },
    caret: (blockId, from, to) => {
      if (context.held.editing !== blockId) return;
      const signal = textSignal(blockId, from, to);
      if (sameSelection(context.view.selection, signal.selection) && context.view.inspected === signal.key) return;
      context.view.inspect(signal.key, signal.selection);
    },
    badge: (id) => {
      const slide = context.slide;
      if (slide === undefined) return;
      const signal = threadsSignal(id === "" ? slide.id : id);
      if (id !== "") select([id]);
      context.view.inspect(signal.key, signal.selection);
    },
    prompt: (id) => {
      const body = context.body;
      if (body === undefined || elementIn(body, id)?.content.type !== "prompt") return;
      select([id]);
    }
  };
};
