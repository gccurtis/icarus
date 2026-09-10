import type { ScopeDraft } from "$representation/data/behavior/core/scope-draft";
import {
  defaultScopeOf,
  holeMarkOver,
  holeNameOver
} from "$representation/data/behavior/templates/prompt-holes";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { TemplateHole } from "$representation/data/types/templates/template";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export type ChosenHole = Omit<TemplateHole, "default"> & { default?: ScopeDraft };

export const withHoleField = (
  holes: readonly ChosenHole[],
  name: string,
  change: { label?: string; description?: string; default?: ScopeDraft; text?: string }
): readonly ChosenHole[] =>
  holes.map((hole) => {
    if (hole.name !== name) return hole;
    const next: ChosenHole = {
      name: hole.name,
      label: change.label ?? hole.label,
      kind: hole.kind
    };
    const description = "description" in change ? change.description : hole.description;
    const fallback = "default" in change ? change.default : hole.default;
    const words = "text" in change ? change.text : hole.text;
    if (description !== undefined && description.trim().length > 0) next.description = description.trim();
    if (fallback !== undefined) next.default = fallback;
    if (words !== undefined && words.trim().length > 0) next.text = words;
    return next;
  });

export const mergedHoles = (
  held: readonly ChosenHole[],
  inserted: readonly ChosenHole[]
): readonly ChosenHole[] => {
  const names = new Set(held.map((hole) => hole.name));
  return [...held, ...inserted.filter((hole) => !names.has(hole.name))];
};

const blockAt = (body: SlideDeckBody, blockId: string) => {
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
  const include = held.include.filter((term) => term.select !== "hole");
  const exclude = held.exclude.filter((term) => term.select !== "hole");
  return include.length === held.include.length && exclude.length === held.exclude.length
    ? { include, exclude }
    : undefined;
};

export const selectedWords = (
  body: SlideDeckBody,
  range: { readonly blockId: string; readonly from: number; readonly to: number } | undefined
): string => {
  if (range === undefined) return "";
  const block = blockAt(body, range.blockId);
  if (block === undefined) return "";
  return block.display.slice(Math.min(range.from, range.to), Math.max(range.from, range.to));
};

export const markedHoleAt = (
  body: SlideDeckBody,
  range: { readonly blockId: string; readonly from: number; readonly to: number } | undefined
): string | undefined => {
  if (range === undefined) return undefined;
  const block = blockAt(body, range.blockId);
  return block === undefined ? undefined : holeNameOver(block.atoms, block.marks, range.from, range.to);
};

export const markHoleOps = (
  body: SlideDeckBody,
  range: { readonly blockId: string; readonly from: number; readonly to: number } | undefined,
  name: string
): readonly SlideDeckOp[] => {
  if (range === undefined) return [];
  const block = blockAt(body, range.blockId);
  if (block === undefined) return [];
  const mark = holeMarkOver(block.atoms, range.from, range.to, name.trim(), () => mint("mark"));
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
