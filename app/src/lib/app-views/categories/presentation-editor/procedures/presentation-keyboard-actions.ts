import { nudged } from "$app-views/categories/presentation-editor/procedures/arrange";
import type {
  PresentationActionContext,
  PresentationGeometryActions,
  PresentationSelectionActions
} from "$app-views/categories/presentation-editor/procedures/presentation-action-context";
import { withDuplicatedElements, withoutElements } from "$app-views/categories/presentation-editor/procedures/presentation-elements";
import { withGrouped, withUngrouped } from "$app-views/categories/presentation-editor/procedures/presentation-layering";
import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
import { blockIn, elementIn, textOf } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
import { rangeOf } from "$app-views/categories/presentation-editor/procedures/selecting";
import { toggledMark } from "$app-views/categories/presentation-editor/procedures/typing";

export const createPresentationKeyboardAction = (
  context: PresentationActionContext,
  selection: PresentationSelectionActions,
  geometry: PresentationGeometryActions
) => (event: KeyboardEvent): void => {
  const body = context.body;
  const slide = context.slide;
  if (body === undefined || slide === undefined || event.defaultPrevented) return;
  const mod = event.metaKey || event.ctrlKey;

  if (context.held.editing !== undefined) {
    const range = rangeOf(context.view.selection);
    if (mod && range && ["b", "i", "u"].includes(event.key.toLowerCase())) {
      const block = blockIn(body, range.blockId);
      if (block === undefined) return;
      event.preventDefault();
      const style = event.key.toLowerCase() === "b"
        ? "bold"
        : event.key.toLowerCase() === "i"
          ? "italic"
          : "underline";
      selection.apply(toggledMark(block, range.from, range.to, style));
    }
    return;
  }

  if (
    event.target instanceof HTMLElement &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable)
  ) return;

  if (event.key === "Escape") {
    if (context.cells.length > 0) selection.select([...context.selected]);
    else selection.clear();
    return;
  }
  if (context.selected.length === 0) return;

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    selection.apply(withoutElements(body, context.selected).ops);
    selection.clear();
    return;
  }
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    const stepX = (event.shiftKey ? 10 : 1) / context.units.width;
    const stepY = (event.shiftKey ? 10 : 1) / context.units.height;
    const dx = event.key === "ArrowLeft" ? -stepX : event.key === "ArrowRight" ? stepX : 0;
    const dy = event.key === "ArrowUp" ? -stepY : event.key === "ArrowDown" ? stepY : 0;
    geometry.frames(
      placedOn(slide)
        .filter((placed) => context.selected.includes(placed.element.id))
        .map((placed) => ({ id: placed.element.id, frame: nudged(placed.frame, dx, dy) }))
    );
    return;
  }
  if (mod && event.key.toLowerCase() === "g") {
    event.preventDefault();
    if (event.shiftKey) {
      selection.apply(withUngrouped(body, context.selected[0]).ops);
      selection.clear();
    } else {
      const edit = withGrouped(body, context.selected);
      const made = edit.body.slides
        .find((held) => held.id === slide.id)
        ?.elements.find((element) =>
          element.content.type === "group" &&
          !slide.elements.some((was) => was.id === element.id)
        );
      selection.apply(edit.ops);
      if (made !== undefined) selection.select([made.id]);
    }
    return;
  }
  if (mod && event.key.toLowerCase() === "d") {
    event.preventDefault();
    const edit = withDuplicatedElements(body, context.selected);
    const fresh = edit.body.slides
      .find((held) => held.id === slide.id)
      ?.elements.filter((element) => !slide.elements.some((was) => was.id === element.id))
      .map((element) => element.id) ?? [];
    selection.apply(edit.ops);
    if (fresh.length > 0) selection.select(fresh);
    return;
  }
  if (mod || event.altKey || context.selected.length !== 1 || context.cells.length > 0) return;

  const element = elementIn(body, context.selected[0]);
  if (
    element === undefined ||
    (element.content.type !== "text" &&
      element.content.type !== "prompt" &&
      element.content.type !== "shape")
  ) return;
  if (event.key === "Enter") {
    event.preventDefault();
    const block = textOf(element);
    if (block !== undefined) selection.enter(element.id, block.id);
    else selection.startTyping(element.id, "");
  } else if (event.key.length === 1) {
    event.preventDefault();
    selection.startTyping(element.id, event.key);
  }
};
