import type { Frame, PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp, PresentationSetTarget } from "$representation/data/types/presentations/op";
import { nodeIn } from "$representation/data/behavior/presentations/apply-ops";
import { presentationEdit, noPresentationEdit, type Edit } from "$app-views/categories/presentation-editor/procedures/presentation-edit";
import { relativeTo } from "$app-views/categories/presentation-editor/procedures/presentation-geometry";
import { placedById } from "$app-views/categories/presentation-editor/procedures/presentation-placed-element";
import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";

export const valueAt = (body: PresentationBody, path: string): unknown => {
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
  body: PresentationBody,
  target: PresentationSetTarget,
  path: string,
  value: unknown
): Edit => {
  const was = valueAt(body, path);
  if (JSON.stringify(was) === JSON.stringify(value)) return noPresentationEdit(body);
  return presentationEdit(body, [{ op: "set", target, path, value, was: was === undefined ? null : was }]);
};

export const withSets = (
  body: PresentationBody,
  sets: readonly { target: PresentationSetTarget; path: string; value: unknown }[]
): Edit => {
  const ops: PresentationOp[] = [];
  let held = body;
  for (const { target, path, value } of sets) {
    const step = withSet(held, target, path, value);
    held = step.body;
    ops.push(...step.ops);
  }
  return { body: held, ops };
};

export const withElementFrame = (body: PresentationBody, elementId: string, frame: Frame): Edit => {
  const slide = slideHolding(body, elementId);
  if (slide === undefined) return noPresentationEdit(body);
  const placed = placedById(slide, elementId);
  if (placed === undefined) return noPresentationEdit(body);

  const outer = placed.parents.length === 0
    ? undefined
    : placedById(slide, placed.parents[placed.parents.length - 1])?.frame;
  const stored = outer === undefined ? frame : relativeTo(outer, frame);
  return withSet(body, "element", `${elementId}/frame`, stored);
};
