import type { Mark as ProseMirrorMark, Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";

import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { endAt } from "$app-views/categories/document-editor/procedures/projection-atoms";
import { atomsOf } from "$app-views/categories/document-editor/procedures/projection-body";
import { displayOfChild } from "$app-views/categories/document-editor/procedures/projection-inline";

export const displayOffsetOf = (block: ProseMirrorNode, offset: number): number => {
  let pm = 0;
  let display = 0;
  for (let index = 0; index < block.childCount && pm < offset; index += 1) {
    const child = block.child(index);
    if (child.type.name === "formula_atom" || child.type.name === "template_atom") {
      pm += 1;
      display += displayOfChild(child).length;
      continue;
    }
    const length = child.text?.length ?? 0;
    const taken = Math.min(length, offset - pm);
    pm += taken;
    display += taken;
  }
  return display;
};

export const proseOffsetOf = (block: ProseMirrorNode, display: number): number => {
  let pm = 0;
  let seen = 0;
  for (let index = 0; index < block.childCount && seen < display; index += 1) {
    const child = block.child(index);
    if (child.type.name === "formula_atom" || child.type.name === "template_atom") {
      const length = displayOfChild(child).length;
      if (seen + length > display) break;
      seen += length;
      pm += 1;
      continue;
    }
    const length = child.text?.length ?? 0;
    const taken = Math.min(length, display - seen);
    seen += taken;
    pm += taken;
  }
  return pm;
};

export type Anchor = { readonly blockId: string; readonly offset: number };

export const anchorAt = ($from: ResolvedPos): Anchor | undefined => {
  const block = $from.parent;
  if (block.type.name !== "text_block" || typeof block.attrs.blockId !== "string") return undefined;
  return { blockId: block.attrs.blockId, offset: displayOffsetOf(block, $from.parentOffset) };
};

export const positionOf = (doc: ProseMirrorNode, anchor: Anchor): number | undefined => {
  let found: number | undefined;
  doc.descendants((node, at) => {
    if (found !== undefined) return false;
    if (node.type.name !== "text_block" || node.attrs.blockId !== anchor.blockId) return;
    found = at + 1 + proseOffsetOf(node, anchor.offset);
    return false;
  });
  return found;
};

export type AtomAddress = { readonly blockId: string; readonly atomId: string; readonly offset: number };

export const addressAt = ($at: ResolvedPos): AtomAddress | undefined => {
  const block = $at.parent;
  if (block.type.name !== "text_block" || typeof block.attrs.blockId !== "string") return undefined;
  const { atoms } = atomsOf(block);
  const end = endAt(atoms, displayOffsetOf(block, $at.parentOffset), "from");
  return { blockId: block.attrs.blockId, atomId: end.atom, offset: end.offset };
};

export const withFreshMarkIds = (nodes: readonly ProseMirrorNode[]): ProseMirrorNode[] => {
  const fresh = new Map<string, string>();
  const renamed = (mark: ProseMirrorMark): ProseMirrorMark => {
    const id = mark.attrs.markId as string | null;
    if (id === null) return mark;
    const next = fresh.get(id) ?? mint("mark");
    fresh.set(id, next);
    return mark.type.create({ ...mark.attrs, markId: next });
  };
  return nodes.map((node) => node.mark(node.marks.map(renamed)));
};
