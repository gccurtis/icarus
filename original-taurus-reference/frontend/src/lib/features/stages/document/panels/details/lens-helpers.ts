import { blockKindLabel } from '$data/documents';
import type { InspectedBlock, SelectionInfo } from '../../editor/session';

/**
 * Shared helpers for the Details inspector's lenses — the pure bits that would
 * otherwise be duplicated across the lens components. Nothing here touches the
 * editor session; lenses pass in what they already hold.
 */

/** Narrowed selection slices. A lens takes exactly its own variant, so it never
 *  re-checks `selection.mode` and cannot read a field another mode owns. */
export type RunSelection = Extract<SelectionInfo, { mode: 'run' }>;
export type NewTextSelection = Extract<SelectionInfo, { mode: 'new-text' }>;
export type NewBlockSelection = Extract<SelectionInfo, { mode: 'new-block' }>;
export type BlockSelection = Extract<SelectionInfo, { mode: 'block' }>;

/**
 * Row targets for row-scoped controls (line spacing), de-duplicated in document
 * order. A block that has no row yet — freshly inserted, not round-tripped —
 * falls back to a synthetic key so the control still seeds from `rowHeights`.
 * A `run` selection has no blocks to ask and names its rows itself (`rowIds`).
 */
export function rowKeysOf(blocks: InspectedBlock[]): string[] {
  return [...new Set(blocks.map((block) => block.rowId ?? `block:${block.blockId ?? block.pos}`))];
}

/** The server-known block ids among the given blocks — the only ones an op can target. */
export function blockIdsOf(blocks: InspectedBlock[]): string[] {
  return blocks.map((block) => block.blockId).filter((id): id is string => !!id);
}

export function wordCount(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

export function blockKindName(block: InspectedBlock): string {
  return blockKindLabel(block.kind);
}

/**
 * Identity of the current selection. Controls that hold a draft (the reference
 * field, the prompt instruction) compare this against the key they last seeded
 * from, so they re-seed when the user moves to a different target but never
 * clobber what is being typed.
 */
export function selectionKey(selection: SelectionInfo): string {
  if (selection.mode === 'run') return `run:${selection.blockIds.join(':')}:${selection.text}`;
  if (selection.mode === 'new-text')
    return `new-text:${selection.block.blockId ?? selection.block.pos}:${selection.caret}`;
  if (selection.mode === 'block' || selection.mode === 'new-block')
    return `${selection.mode}:${selection.block.blockId ?? selection.block.pos}`;
  if (selection.mode === 'blocks')
    return `blocks:${selection.items.map((block) => block.blockId ?? block.pos).join(':')}`;
  if (selection.mode === 'row') return `row:${selection.rowId}`;
  return 'none';
}
