import type { Mark as PmMark, Node as PmNode } from 'prosemirror-model';
import { NodeSelection, type EditorState } from 'prosemirror-state';
import type { MarkKind } from '$data/documents';
import { nodeKind, nodeSubKind } from '../editor/bridge';
import { schema } from '../editor/schema';
import type { InspectedBlock, SelectionInfo, TypographyState } from '../editor/session';

/**
 * The SELECTION MODEL — the pure translation from ProseMirror's selection to the
 * inspector's vocabulary (`SelectionInfo`, see editor/session.ts).
 *
 * Every function here is a pure read of an `EditorState`: no stores, no network,
 * no runtime instance. That is what makes the seven inspector lenses testable
 * without standing up a document runtime.
 */

/**
 * A pinned inspection overriding the live selection. Only `actions.inspectBlock`
 * sets one today (always `block`); the `blocks`/`row` variants match the frozen
 * `SelectionInfo` vocabulary but have had no producer since the gutter's removal
 * (UX1: editing must feel like a text editor — no block-manipulation chrome;
 * the block data model itself stays).
 */
export type InspectionOverride =
  | { mode: 'block' | 'blocks'; blockIds: string[] }
  | { mode: 'row'; rowId: string; blockIds: string[] };

/**
 * The result of deriving a selection. `clearInspection` reports that a pinned
 * inspection no longer resolves to anything (its blocks are gone), so the caller
 * should drop it — returned rather than mutated so this stays a pure function.
 */
export type DerivedSelection = {
  selection: SelectionInfo;
  clearInspection: boolean;
};

/** Active inline font/fg/bg values from a set of marks (the first of each). */
export function inlineStyleFrom(marks: readonly PmMark[]) {
  const font = marks.find((m) => m.type === schema.marks.font);
  const fg = marks.find((m) => m.type === schema.marks.fg);
  const bg = marks.find((m) => m.type === schema.marks.bg);
  return {
    fontFamily: font ? String(font.attrs.family ?? '') : '',
    fontSize: font ? String(font.attrs.size ?? '') : '',
    fg: fg ? String(fg.attrs.value ?? '') : '',
    bg: bg ? String(bg.attrs.value ?? '') : ''
  };
}

/** Inline format state over a concrete range (Selected Text). */
export function markState(doc: PmNode, from: number, to: number): TypographyState {
  const marks: Record<MarkKind, boolean> = {
    bold: doc.rangeHasMark(from, to, schema.marks.strong),
    italic: doc.rangeHasMark(from, to, schema.marks.em),
    underline: doc.rangeHasMark(from, to, schema.marks.underline),
    strike: doc.rangeHasMark(from, to, schema.marks.strike),
    code: doc.rangeHasMark(from, to, schema.marks.code),
    link: doc.rangeHasMark(from, to, schema.marks.link),
    font: doc.rangeHasMark(from, to, schema.marks.font),
    fg: doc.rangeHasMark(from, to, schema.marks.fg),
    bg: doc.rangeHasMark(from, to, schema.marks.bg)
  };
  let linkHref = '';
  const styled: PmMark[] = [];
  doc.nodesBetween(from, to, (node) => {
    for (const m of node.marks) styled.push(m);
    if (!linkHref) {
      const link = node.marks.find((mark) => mark.type === schema.marks.link);
      if (link) linkHref = String(link.attrs.href ?? '');
    }
  });
  return { marks, linkHref, ...inlineStyleFrom(styled) };
}

/** Inline format state at the caret — what the next typed character will carry. */
export function insertionMarkState(state: EditorState): TypographyState {
  const active = state.storedMarks ?? state.selection.$from.marks();
  const marks: Record<MarkKind, boolean> = {
    bold: active.some((mark) => mark.type === schema.marks.strong),
    italic: active.some((mark) => mark.type === schema.marks.em),
    underline: active.some((mark) => mark.type === schema.marks.underline),
    strike: active.some((mark) => mark.type === schema.marks.strike),
    code: active.some((mark) => mark.type === schema.marks.code),
    link: active.some((mark) => mark.type === schema.marks.link),
    font: active.some((mark) => mark.type === schema.marks.font),
    fg: active.some((mark) => mark.type === schema.marks.fg),
    bg: active.some((mark) => mark.type === schema.marks.bg)
  };
  const link = active.find((mark) => mark.type === schema.marks.link);
  return { marks, linkHref: link ? String(link.attrs.href ?? '') : '', ...inlineStyleFrom(active) };
}

/** Describe one top-level block without exposing ProseMirror types. */
export function blockAt(doc: PmNode, pos: number): InspectedBlock | null {
  const node = doc.nodeAt(pos);
  if (!node?.isBlock) return null;
  return {
    blockId: (node.attrs.blockId as string | null) ?? null,
    rowId: (node.attrs.rowId as string | null) ?? null,
    pos,
    kind: nodeKind(node),
    subKind: nodeSubKind(node),
    ...(node.type.name === 'list'
      ? { listType: String(node.attrs.listType), listStart: Number(node.attrs.start) || 1 }
      : {}),
    text: node.textContent,
    empty: node.textContent.length === 0
  };
}

/** The blocks matching a set of server ids, in document order. */
export function blocksById(doc: PmNode, blockIds: string[]): InspectedBlock[] {
  const wanted = new Set(blockIds);
  const blocks: InspectedBlock[] = [];
  doc.forEach((node, offset) => {
    if (wanted.has(String(node.attrs.blockId ?? ''))) {
      const block = blockAt(doc, offset);
      if (block) blocks.push(block);
    }
  });
  return blocks;
}

/**
 * The document position of a block, by its server id — `null` when the block is
 * not in the document. Actions that were handed a block id (an outline click, a
 * row-child click) need a position before they can build a transaction.
 */
export function blockPositionOf(doc: PmNode, blockId: string): number | null {
  let pos: number | null = null;
  doc.forEach((node, offset) => {
    if (pos == null && node.attrs.blockId === blockId) pos = offset;
  });
  return pos;
}

/** One block, as either the `block` lens or the `new-block` lens. */
export function blockSelection(state: EditorState, block: InspectedBlock): SelectionInfo {
  // An empty text block is a "new block": it formats like next-text (carries the
  // insertion typography) and offers Insert element + Text type.
  if (block.empty && block.kind === 'text')
    return { mode: 'new-block', block, ...insertionMarkState(state) };
  return { mode: 'block', block };
}

/** The current selection in the inspector's vocabulary (see editor/session.ts). */
export function deriveSelection(
  state: EditorState,
  inspection: InspectionOverride | null
): DerivedSelection {
  const doc = state.doc;
  if (inspection) {
    const items = blocksById(doc, inspection.blockIds);
    if (inspection.mode === 'row' && items.length)
      return { selection: { mode: 'row', rowId: inspection.rowId, items }, clearInspection: false };
    if (inspection.mode === 'blocks' && items.length > 1)
      return { selection: { mode: 'blocks', items }, clearInspection: false };
    if (items[0])
      return { selection: blockSelection(state, items[0]), clearInspection: false };
    // The pinned blocks are gone — fall through to the live selection and tell
    // the caller to drop the stale inspection.
    return { ...liveSelection(state), clearInspection: true };
  }
  return liveSelection(state);
}

function liveSelection(state: EditorState): DerivedSelection {
  const doc = state.doc;
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.isBlock) {
    const block = blockAt(doc, sel.from);
    return {
      selection: block ? blockSelection(state, block) : { mode: 'none' },
      clearInspection: false
    };
  }
  const from = sel.$from;
  if (sel.empty) {
    if (from.depth < 1) return { selection: { mode: 'none' }, clearInspection: false };
    const block = blockAt(doc, from.before(1));
    if (!block) return { selection: { mode: 'none' }, clearInspection: false };
    // Only text-formatting kinds get the Next Text lens; code/divider/image/etc.
    // inspect as their block instead of offering inline typography.
    if (block.kind !== 'text' && block.kind !== 'callout')
      return { selection: blockSelection(state, block), clearInspection: false };
    if (block.empty && block.kind === 'text')
      return { selection: blockSelection(state, block), clearInspection: false };
    return {
      selection: { mode: 'new-text', block, caret: sel.from, ...insertionMarkState(state) },
      clearInspection: false
    };
  }
  const text = doc.textBetween(sel.from, sel.to, '\n');
  const blockIds: string[] = [];
  // The rows the run touches, collected in the same walk — row-scoped controls
  // (line spacing) need them and a run selection has no InspectedBlocks to ask.
  const rowIds: string[] = [];
  doc.forEach((node, offset) => {
    if (offset < sel.to && offset + node.nodeSize > sel.from) {
      const blockId = node.attrs.blockId as string | null;
      if (blockId) blockIds.push(blockId);
      const rowId = node.attrs.rowId as string | null;
      if (rowId && !rowIds.includes(rowId)) rowIds.push(rowId);
    }
  });
  const startBlock = from.depth >= 1 ? blockAt(doc, from.before(1)) : null;
  return {
    selection: {
      mode: 'run',
      blockIds,
      rowIds,
      text,
      chars: text.length,
      words: (text.match(/\S+/g) ?? []).length,
      subKind: startBlock?.kind === 'text' ? (startBlock.subKind ?? 'body') : undefined,
      ...markState(doc, sel.from, sel.to)
    },
    clearInspection: false
  };
}
