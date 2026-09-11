import type { Slide, PresentationBody, SlideElement } from "$representation/data/types/presentations/body";
import { restacked, type Restack } from "$app-views/categories/presentation-editor/procedures/arrange";
import { presentationEdit, idBefore, noPresentationEdit, type Edit } from "$app-views/categories/presentation-editor/procedures/presentation-edit";
import {
  siblingsOf,
  withInsertedElements,
  withoutElements
} from "$app-views/categories/presentation-editor/procedures/presentation-elements";
import { boundsOf, relativeTo, within } from "$app-views/categories/presentation-editor/procedures/presentation-geometry";
import { placedById } from "$app-views/categories/presentation-editor/procedures/presentation-placed-element";
import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
import { mint } from "$app-views/categories/presentation-editor/procedures/ids";

const listPathFor = (slide: Slide, parents: readonly string[]): string =>
  parents.length === 0 ? `${slide.id}/elements` : `${parents[parents.length - 1]}/content/children`;

export const withRestacked = (body: PresentationBody, id: string, way: Restack): Edit => {
  const slide = slideHolding(body, id);
  if (slide === undefined) return noPresentationEdit(body);
  const placed = placedById(slide, id);
  if (placed === undefined) return noPresentationEdit(body);
  const siblings = siblingsOf(slide, placed.parents);
  const at = siblings.findIndex((element) => element.id === id);
  const last = siblings.length - 1;
  const wasAfter = idBefore(siblings, id);

  const after =
    way === "front" ? (at === last ? wasAfter : siblings[last].id)
    : way === "forward" ? (at === last ? wasAfter : siblings[at + 1].id)
    : way === "back" ? null
    : at === 0 ? null : (at === 1 ? null : siblings[at - 2].id);

  if (after === wasAfter) return noPresentationEdit(body);
  return presentationEdit(body, [
    { op: "move", target: "element", path: listPathFor(slide, placed.parents), id, after, wasAfter }
  ]);
};

export const withRestackedSet = (body: PresentationBody, ids: readonly string[], way: Restack): Edit => {
  const first = ids[0];
  if (first === undefined) return noPresentationEdit(body);
  const slide = slideHolding(body, first);
  if (slide === undefined) return noPresentationEdit(body);
  const placed = placedById(slide, first);
  if (placed === undefined) return noPresentationEdit(body);

  const order = siblingsOf(slide, placed.parents).map((element) => element.id);
  const target = restacked(order, ids, way);
  const path = listPathFor(slide, placed.parents);
  const working = [...order];
  const ops: Edit["ops"][number][] = [];

  target.forEach((id, index) => {
    const after = index === 0 ? null : target[index - 1];
    const at = working.indexOf(id);
    const wasAfter = at <= 0 ? null : working[at - 1];
    if (wasAfter === after) return;
    ops.push({ op: "move", target: "element", path, id, after, wasAfter });
    working.splice(at, 1);
    working.splice(after === null ? 0 : working.indexOf(after) + 1, 0, id);
  });

  return presentationEdit(body, ops);
};

export const withReorderedElement = (body: PresentationBody, id: string, after: string | null): Edit => {
  const slide = slideHolding(body, id);
  if (slide === undefined) return noPresentationEdit(body);
  const placed = placedById(slide, id);
  if (placed === undefined) return noPresentationEdit(body);
  const siblings = siblingsOf(slide, placed.parents);
  const wasAfter = idBefore(siblings, id);
  if (after === id || after === wasAfter) return noPresentationEdit(body);
  if (after !== null && !siblings.some((element) => element.id === after)) return noPresentationEdit(body);
  return presentationEdit(body, [
    { op: "move", target: "element", path: listPathFor(slide, placed.parents), id, after, wasAfter }
  ]);
};

export const withGrouped = (body: PresentationBody, ids: readonly string[]): Edit => {
  if (ids.length < 2) return noPresentationEdit(body);
  const slide = slideHolding(body, ids[0]);
  if (slide === undefined) return noPresentationEdit(body);
  const members = slide.elements.filter((element) => ids.includes(element.id));
  if (members.length !== ids.length) return noPresentationEdit(body);

  const bounds = boundsOf(members.map((member) => member.frame));
  const group: SlideElement = {
    id: mint("element"),
    frame: bounds,
    content: {
      type: "group",
      children: members.map((member) => ({ ...member, frame: relativeTo(bounds, member.frame) }))
    }
  };
  const top = slide.elements.findIndex((element) => element.id === members[members.length - 1].id);
  let anchor: string | null = null;
  for (let index = top - 1; index >= 0; index -= 1) {
    if (!ids.includes(slide.elements[index].id)) {
      anchor = slide.elements[index].id;
      break;
    }
  }

  const removal = withoutElements(body, ids);
  const insertion = withInsertedElements(removal.body, slide.id, [group], anchor);
  return { body: insertion.body, ops: [...removal.ops, ...insertion.ops] };
};

export const withUngrouped = (body: PresentationBody, groupId: string): Edit => {
  const slide = slideHolding(body, groupId);
  if (slide === undefined) return noPresentationEdit(body);
  const placed = placedById(slide, groupId);
  if (placed === undefined || placed.element.content.type !== "group" || placed.parents.length > 0) {
    return noPresentationEdit(body);
  }

  const children = placed.element.content.children.map((child) => ({
    ...child,
    frame: within(placed.frame, child.frame)
  }));
  const anchor = idBefore(slide.elements, groupId);
  const removal = withoutElements(body, [groupId]);
  const insertion = withInsertedElements(removal.body, slide.id, children, anchor);
  return { body: insertion.body, ops: [...removal.ops, ...insertion.ops] };
};

export type { Restack } from "$app-views/categories/presentation-editor/procedures/arrange";
