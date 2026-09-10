import type { ScopeDraft } from "$representation/data/behavior/core/scope-draft";
import { linearOf } from "$representation/data/behavior/content/positions";
import {
  defaultScopeOf,
  holeMarkOver,
  holeNameOver
} from "$representation/data/behavior/templates/prompt-holes";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { TemplateHole } from "$representation/data/types/templates/template";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
import type { Selection } from "$model/client/workspace-state";

/** A chosen rule may exclude things or name resources before the server stores it. */
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

const blockWithAtoms = (body: DocumentBody, blockId: string) => {
  for (const row of body.rows) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) {
      if (block.id !== blockId) continue;
      return block.type === "text" || block.type === "prompt" ? block : undefined;
    }
  }
  return undefined;
};

/** A stored scope with unresolved template holes removed from ordinary retrieval. */
export const readableScope = (scope: unknown): ResourceSet | undefined => {
  const held = defaultScopeOf(scope);
  if (held === undefined) return undefined;
  const include = held.include.filter((term) => term.select !== "hole");
  const exclude = held.exclude.filter((term) => term.select !== "hole");
  return include.length === held.include.length && exclude.length === held.exclude.length
    ? { include, exclude }
    : undefined;
};

export const selectedRange = (
  body: DocumentBody,
  selection: Selection | undefined
): { readonly blockId: string; readonly from: number; readonly to: number } | undefined => {
  if (selection === undefined || selection.at === undefined) return undefined;
  const start = addressOf(selection.id);
  const end = addressOf(selection.at);
  if (start === undefined || end === undefined || start.blockId !== end.blockId) return undefined;
  const block = blockWithAtoms(body, start.blockId);
  if (block === undefined) return undefined;
  const from = linearOf(block.atoms, { atom: start.atomId, offset: start.offset });
  const to = linearOf(block.atoms, { atom: end.atomId, offset: end.offset });
  return from === to ? undefined : { blockId: block.id, from: Math.min(from, to), to: Math.max(from, to) };
};

export const selectedWords = (body: DocumentBody, selection: Selection | undefined): string => {
  const range = selectedRange(body, selection);
  if (range === undefined) return "";
  return blockWithAtoms(body, range.blockId)?.display.slice(range.from, range.to) ?? "";
};

export const markedHoleAt = (
  body: DocumentBody,
  selection: Selection | undefined
): string | undefined => {
  const range = selectedRange(body, selection);
  if (range === undefined) return undefined;
  const block = blockWithAtoms(body, range.blockId);
  return block === undefined ? undefined : holeNameOver(block.atoms, block.marks, range.from, range.to);
};

export const markHoleOps = (
  body: DocumentBody,
  selection: Selection | undefined,
  name: string
): readonly DocumentOp[] => {
  const range = selectedRange(body, selection);
  if (range === undefined) return [];
  const block = blockWithAtoms(body, range.blockId);
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
