import type { Frame, SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp, SlideDeckSetTarget } from "$representation/data/types/slide-decks/op";
import { nodeIn } from "$representation/data/behavior/slide-decks/apply-ops";
import { deckEdit, noDeckEdit, type Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";
import { relativeTo } from "$app-views/categories/slide-deck-editor/procedures/deck-geometry";
import { placedById } from "$app-views/categories/slide-deck-editor/procedures/deck-placed-element";
import { slideHolding } from "$app-views/categories/slide-deck-editor/procedures/deck-slide-holding";

export const valueAt = (body: SlideDeckBody, path: string): unknown => {
  const [head, ...rest] = path.split("/");
  const root = body as unknown as Record<string, unknown>;
  let node: unknown = head in root ? root[head] : nodeIn(body, head);
  for (const segment of rest) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
};

export const withSet = (
  body: SlideDeckBody,
  target: SlideDeckSetTarget,
  path: string,
  value: unknown
): Edit => {
  const was = valueAt(body, path);
  if (JSON.stringify(was) === JSON.stringify(value)) return noDeckEdit(body);
  return deckEdit(body, [{ op: "set", target, path, value, was: was === undefined ? null : was }]);
};

export const withSets = (
  body: SlideDeckBody,
  sets: readonly { target: SlideDeckSetTarget; path: string; value: unknown }[]
): Edit => {
  const ops: SlideDeckOp[] = [];
  let held = body;
  for (const { target, path, value } of sets) {
    const step = withSet(held, target, path, value);
    held = step.body;
    ops.push(...step.ops);
  }
  return { body: held, ops };
};

export const withElementFrame = (body: SlideDeckBody, elementId: string, frame: Frame): Edit => {
  const slide = slideHolding(body, elementId);
  if (slide === undefined) return noDeckEdit(body);
  const placed = placedById(slide, elementId);
  if (placed === undefined) return noDeckEdit(body);

  const outer = placed.parents.length === 0
    ? undefined
    : placedById(slide, placed.parents[placed.parents.length - 1])?.frame;
  const stored = outer === undefined ? frame : relativeTo(outer, frame);
  return withSet(body, "element", `${elementId}/frame`, stored);
};
