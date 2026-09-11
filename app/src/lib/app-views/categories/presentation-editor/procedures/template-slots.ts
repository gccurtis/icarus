import type { ScopeDraft } from "$representation/data/behavior/core/scope-draft";
import {
  defaultScopeOf,
  slotMarkOver,
  slotNameOver
} from "$representation/data/behavior/templates/prompt-slots";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import type { TemplateSlot } from "$representation/data/types/templates/template";
import { mint } from "$app-views/categories/presentation-editor/procedures/ids";

export type ChosenSlot = Omit<TemplateSlot, "default"> & { default?: ScopeDraft };

export const withSlotField = (
  slots: readonly ChosenSlot[],
  name: string,
  change: { label?: string; description?: string; default?: ScopeDraft; text?: string }
): readonly ChosenSlot[] =>
  slots.map((slot) => {
    if (slot.name !== name) return slot;
    const next: ChosenSlot = {
      name: slot.name,
      label: change.label ?? slot.label,
      kind: slot.kind
    };
    const description = "description" in change ? change.description : slot.description;
    const fallback = "default" in change ? change.default : slot.default;
    const words = "text" in change ? change.text : slot.text;
    if (description !== undefined && description.trim().length > 0) next.description = description.trim();
    if (fallback !== undefined) next.default = fallback;
    if (words !== undefined && words.trim().length > 0) next.text = words;
    return next;
  });

export const mergedSlots = (
  held: readonly ChosenSlot[],
  inserted: readonly ChosenSlot[]
): readonly ChosenSlot[] => {
  const names = new Set(held.map((slot) => slot.name));
  return [...held, ...inserted.filter((slot) => !names.has(slot.name))];
};

const blockAt = (body: PresentationBody, blockId: string) => {
  for (const slide of body.slides) {
    for (const element of slide.elements) {
      const content = element.content;
      if (content.type !== "text" && content.type !== "prompt") continue;
      if (content.block.id === blockId) return content.block;
    }
  }
  return undefined;
};

export const readableScope = (scope: unknown): ResourceSet | undefined => {
  const held = defaultScopeOf(scope);
  if (held === undefined) return undefined;
  const include = held.include.filter((term) => term.select !== "slot");
  const exclude = held.exclude.filter((term) => term.select !== "slot");
  return include.length === held.include.length && exclude.length === held.exclude.length
    ? { include, exclude }
    : undefined;
};

export const selectedWords = (
  body: PresentationBody,
  range: { readonly blockId: string; readonly from: number; readonly to: number } | undefined
): string => {
  if (range === undefined) return "";
  const block = blockAt(body, range.blockId);
  if (block === undefined) return "";
  return block.display.slice(Math.min(range.from, range.to), Math.max(range.from, range.to));
};

export const markedSlotAt = (
  body: PresentationBody,
  range: { readonly blockId: string; readonly from: number; readonly to: number } | undefined
): string | undefined => {
  if (range === undefined) return undefined;
  const block = blockAt(body, range.blockId);
  return block === undefined ? undefined : slotNameOver(block.atoms, block.marks, range.from, range.to);
};

export const markSlotOps = (
  body: PresentationBody,
  range: { readonly blockId: string; readonly from: number; readonly to: number } | undefined,
  name: string
): readonly PresentationOp[] => {
  if (range === undefined) return [];
  const block = blockAt(body, range.blockId);
  if (block === undefined) return [];
  const mark = slotMarkOver(block.atoms, range.from, range.to, name.trim(), () => mint("mark"));
  if (mark === undefined) return [];
  return [{
    op: "insert",
    target: "mark",
    path: `${block.id}/marks`,
    ids: [mark.id],
    after: block.marks.at(-1)?.id ?? null,
    values: [mark]
  }];
};
