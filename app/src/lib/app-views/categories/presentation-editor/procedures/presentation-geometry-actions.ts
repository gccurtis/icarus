import type {
  PresentationActionContext,
  PresentationGeometryActions,
  PresentationSelectionActions
} from "$app-views/categories/presentation-editor/procedures/presentation-action-context";
import { boundsOf } from "$app-views/categories/presentation-editor/procedures/presentation-geometry";
import { placedById } from "$app-views/categories/presentation-editor/procedures/presentation-placed-element";
import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
import { withElementFrame, withSet, withSets } from "$app-views/categories/presentation-editor/procedures/presentation-values";
import { snapped, targetsOf } from "$app-views/categories/presentation-editor/procedures/snapping";

const SNAP = 0.006;

export const createPresentationGeometryActions = (
  context: PresentationActionContext,
  selection: PresentationSelectionActions
): PresentationGeometryActions => ({
  frames: (moves) => {
    const body = context.body;
    if (body === undefined) return;
    let held = body;
    const ops = [];
    for (const move of moves) {
      const step = withElementFrame(held, move.id, move.frame);
      held = step.body;
      ops.push(...step.ops);
    }
    selection.apply(ops);
  },
  grow: (id, height) => {
    const body = context.body;
    const slide = context.slide;
    if (body === undefined || slide === undefined) return;
    const placed = placedById(slide, id);
    if (placed === undefined) return;
    const next = Math.round(height * 10000) / 10000;
    if (Math.abs(next - placed.frame.height) < 0.0005) return;
    selection.apply(withElementFrame(body, id, { ...placed.frame, height: next }).ops);
  },
  rotate: (id, rotation) => {
    const body = context.body;
    if (body !== undefined) {
      selection.apply(withSet(body, "element", `${id}/rotation`, rotation === 0 ? null : rotation).ops);
    }
  },
  line: (id, from, to) => {
    const body = context.body;
    if (body === undefined) return;
    selection.apply(withSets(body, [
      { target: "element", path: `${id}/content/from`, value: from },
      { target: "element", path: `${id}/content/to`, value: to },
      {
        target: "element",
        path: `${id}/frame`,
        value: boundsOf([
          { x: from.x, y: from.y, width: 0, height: 0 },
          { x: to.x, y: to.y, width: 0, height: 0 }
        ])
      }
    ]).ops);
  },
  snap: (frame, id, alt) => {
    const slide = context.slide;
    if (alt || slide === undefined) return { frame, guides: [] };
    const others = placedOn(slide)
      .filter((placed) =>
        placed.depth === 0 &&
        placed.element.id !== id &&
        !context.selected.includes(placed.element.id)
      )
      .map((placed) => placed.frame);
    return snapped(frame, targetsOf(others), SNAP);
  }
});
