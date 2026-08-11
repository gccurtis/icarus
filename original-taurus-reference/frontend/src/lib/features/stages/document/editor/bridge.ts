import type { Mark as PmMark, Node as PmNode } from 'prosemirror-model';
import { schema } from './schema';
import {
  newUnitId,
  isDataKind,
  isLeafKind,
  headingLevel,
  subKindForLevel,
  type Atom,
  type Anchor,
  type Block,
  type BlockKind,
  type ChangeOp,
  type Doc,
  type DocMark,
  type ListBlockData,
  type ListItem,
  type MarkKind,
  type Row
} from '$data/documents';

/**
 * The Omega ↔ ProseMirror bridge (see docs/architecture/document-editor.md):
 *
 * - `omegaToPmDoc` renders a resolved document into a ProseMirror doc — rows
 *   flattened into a vertical list of block nodes, atoms concatenated into the
 *   node's text, marks mapped from byte-offset anchors to character ranges.
 * - `diffDoc` compares the last-synced snapshot (Omega rows) against the current
 *   ProseMirror doc and produces the id-addressed change ops that turn one into
 *   the other, plus the predicted next snapshot and the blockId/rowId attr
 *   fix-ups for nodes ProseMirror created (Enter, paste). Those top-level nodes
 *   become new Omega rows; sharing a row is reserved for deliberate columns.
 *
 * Write model: each block's text is written as a single atom (a text edit on a
 * multi-atom block consolidates it), and marks are rewritten whole per block —
 * remove the old set, re-add the desired set from the PM node (which preserves
 * mark positions through text edits). Reordering blocks is not detected yet
 * (there is no reorder UI).
 */

// --- byte ↔ character offsets ------------------------------------------------

// Omega mark anchors are UTF-8 byte offsets into an atom's text; JS strings are
// UTF-16. Convert a byte offset to a character (code-unit) offset.
function byteToChar(text: string, byteOffset: number): number {
  let bytes = 0;
  let chars = 0;
  for (const ch of text) {
    if (bytes >= byteOffset) break;
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    chars += ch.length;
  }
  return chars;
}

// The inverse: a character (code-unit) offset → the UTF-8 byte offset.
function charToByte(text: string, charOffset: number): number {
  let bytes = 0;
  let chars = 0;
  for (const ch of text) {
    if (chars >= charOffset) break;
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    chars += ch.length;
  }
  return bytes;
}

// A block-global character position → an Anchor into the block's atoms. At an
// atom boundary, a 'start' anchor opens in the later atom and an 'end' anchor
// closes in the earlier one, so ranges stay inside the atoms they cover.
function charToAnchor(atoms: Atom[], pos: number, side: 'start' | 'end'): Anchor | null {
  let acc = 0;
  for (let i = 0; i < atoms.length; i++) {
    const len = atoms[i].text.length;
    const end = acc + len;
    const take = side === 'start' ? pos < end : pos <= end;
    if ((take || i === atoms.length - 1) && pos >= acc) {
      const charIn = Math.max(0, Math.min(len, pos - acc));
      return { atomId: atoms[i].id, offset: charToByte(atoms[i].text, charIn) };
    }
    acc = end;
  }
  return null;
}

// --- Omega → ProseMirror -----------------------------------------------------

function pmMarkFor(kind: string, attrs?: Record<string, string>): PmMark | null {
  switch (kind) {
    case 'bold':
      return schema.marks.strong.create();
    case 'italic':
      return schema.marks.em.create();
    case 'underline':
      return schema.marks.underline.create();
    case 'strike':
      return schema.marks.strike.create();
    case 'code':
      return schema.marks.code.create();
    case 'link':
      return schema.marks.link.create({ href: attrs?.href ?? '' });
    case 'font':
      return schema.marks.font.create({ family: attrs?.family ?? '', size: attrs?.size ?? '' });
    case 'fg':
      return schema.marks.fg.create({ value: attrs?.value ?? '' });
    case 'bg':
      return schema.marks.bg.create({ value: attrs?.value ?? '' });
    default:
      return null;
  }
}

// Character position of an anchor within the block's concatenated text.
function anchorChar(atoms: Atom[], starts: Map<string, number>, a: Anchor): number | null {
  const atom = atoms.find((x) => x.id === a.atomId);
  if (!atom) return null;
  return (starts.get(atom.id) ?? 0) + byteToChar(atom.text, a.offset);
}

// Inline content for a set of atoms + marks, segmented at mark boundaries. Shared
// by text blocks and list items (both carry atoms + marks the same way).
function inlineContentFrom(atoms: Atom[], blockMarks: DocMark[] | undefined): PmNode[] {
  const text = atoms.map((a) => a.text).join('');
  if (!text) return [];

  const starts = new Map<string, number>();
  let acc = 0;
  for (const a of atoms) {
    starts.set(a.id, acc);
    acc += a.text.length;
  }

  type Range = { from: number; to: number; mark: PmMark };
  const ranges: Range[] = [];
  for (const m of blockMarks ?? []) {
    const from = anchorChar(atoms, starts, m.start);
    const to = anchorChar(atoms, starts, m.end);
    const mark = pmMarkFor(m.kind, m.attrs);
    if (from == null || to == null || to <= from || !mark) continue;
    ranges.push({ from, to, mark });
  }
  if (ranges.length === 0) return [schema.text(text)];

  const bounds = [...new Set([0, text.length, ...ranges.flatMap((r) => [r.from, r.to])])].sort(
    (a, b) => a - b
  );
  const out: PmNode[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (to <= from) continue;
    const marks = ranges.filter((r) => r.from <= from && r.to >= to).map((r) => r.mark);
    out.push(schema.text(text.slice(from, to), marks));
  }
  return out;
}

function inlineContent(block: Block): PmNode[] {
  return inlineContentFrom(block.atoms ?? [], block.marks);
}

// A read-only placeholder label for an image block (round-trip only).
function leafLabel(): string {
  return 'Image';
}

// Build a `list` node from a block's ListBlockData (one list_item per item).
function listNode(block: Block, rowId: string): PmNode {
  const data = block.data as ListBlockData | undefined;
  const items = (data?.items ?? []).map((it) =>
    schema.node(
      'list_item',
      { level: it.level ?? 0, checked: !!it.checked },
      inlineContentFrom(it.atoms ?? [], it.marks)
    )
  );
  return schema.node(
    'list',
    { blockId: block.id, rowId, listType: data?.type ?? 'bullet', start: data?.start ?? 1 },
    items.length ? items : [schema.node('list_item')]
  );
}

function blockNode(block: Block, rowId: string): PmNode {
  const kind = block.kind;
  if (kind === 'text') {
    // A text block's sub-kind decides its node: a heading sub-kind → heading node
    // (level from the sub-kind); body / a custom sub-kind → paragraph node.
    const level = headingLevel(block.subKind);
    if (level) return schema.node('heading', { level, blockId: block.id, rowId }, inlineContent(block));
    return schema.node(
      'paragraph',
      { blockId: block.id, rowId, kind: 'text', subKind: block.subKind || 'body' },
      inlineContent(block)
    );
  }
  if (kind === 'code') {
    // Code blocks hold literal text with no marks (a code_block node, `text*`).
    const text = (block.atoms ?? []).map((a) => a.text).join('');
    return schema.node('code_block', { blockId: block.id, rowId }, text ? schema.text(text) : []);
  }
  if (kind === 'divider') {
    // A leaf: no atoms, no content.
    return schema.node('divider', { blockId: block.id, rowId });
  }
  if (kind === 'list') return listNode(block, rowId);
  if (kind === 'image') {
    // Not editable inline yet — a placeholder that round-trips its typed data.
    return schema.node('block_leaf', { blockId: block.id, rowId, kind, label: leafLabel() });
  }
  // callout and prompt reuse the paragraph node; `kind` preserves the truth
  // (round-tripped through the differ).
  return schema.node('paragraph', { blockId: block.id, rowId, kind }, inlineContent(block));
}

/** Render a resolved Omega document as a ProseMirror doc (rows flattened). */
export function omegaToPmDoc(doc: Doc): PmNode {
  const children: PmNode[] = [];
  for (const row of doc.base.rows) for (const b of row.blocks) children.push(blockNode(b, row.id));
  if (children.length === 0) children.push(schema.node('paragraph'));
  return schema.node('doc', null, children);
}

// --- ProseMirror → change ops ------------------------------------------------

/** The Omega block kind a ProseMirror node represents. A heading node is a `text`
 *  block (its level is carried by the sub-kind); a paragraph node's `kind` attr is
 *  the truth (`text`, `callout`, or `prompt`). */
export function nodeKind(node: PmNode): BlockKind {
  const name = node.type.name;
  if (name === 'heading') return 'text';
  if (name === 'code_block') return 'code';
  if (name === 'divider') return 'divider';
  if (name === 'list') return 'list';
  if (name === 'block_leaf') return (node.attrs.kind as BlockKind) ?? 'image';
  return (node.attrs.kind as BlockKind) ?? 'text';
}

/** The text sub-kind a node represents, or `undefined` for a non-text kind. A
 *  heading node's level maps to `heading_N`; a text paragraph carries its
 *  `subKind` attr (defaulting `body`). */
export function nodeSubKind(node: PmNode): string | undefined {
  if (node.type.name === 'heading') return subKindForLevel(node.attrs.level as number);
  if (node.type.name === 'paragraph' && node.attrs.kind === 'text')
    return (node.attrs.subKind as string) || 'body';
  return undefined;
}

// --- marks: PM node ↔ Omega, in block-global character space -----------------

type CharMark = { kind: MarkKind; from: number; to: number; attrs?: Record<string, string> };

function omegaMarkKind(m: PmMark): MarkKind | null {
  switch (m.type.name) {
    case 'strong':
      return 'bold';
    case 'em':
      return 'italic';
    case 'underline':
      return 'underline';
    case 'strike':
      return 'strike';
    case 'code':
      return 'code';
    case 'link':
      return 'link';
    case 'font':
      return 'font';
    case 'fg':
      return 'fg';
    case 'bg':
      return 'bg';
    default:
      return null;
  }
}

// The Omega attrs a PM mark stores: link → href; font → present family/size; fg/bg
// → value. Empty fields are dropped so comparisons stay stable.
function markAttrs(kind: MarkKind, m: PmMark): Record<string, string> | undefined {
  if (kind === 'link') return { href: String(m.attrs.href ?? '') };
  if (kind === 'font') {
    const a: Record<string, string> = {};
    if (m.attrs.family) a.family = String(m.attrs.family);
    if (m.attrs.size) a.size = String(m.attrs.size);
    return a;
  }
  if (kind === 'fg' || kind === 'bg') return { value: String(m.attrs.value ?? '') };
  return undefined;
}

const attrsKey = (a?: Record<string, string>) =>
  JSON.stringify(a ? Object.fromEntries(Object.entries(a).sort()) : {});
const sameAttrs = (a?: Record<string, string>, b?: Record<string, string>) =>
  attrsKey(a) === attrsKey(b);

// The same normalization as `markAttrs`, but from a stored DocMark's attrs — so a
// snapshot mark and a PM mark compare equal when they carry the same styling.
function markAttrsFromDoc(kind: MarkKind, attrs?: Record<string, string>): Record<string, string> | undefined {
  if (kind === 'link') return { href: attrs?.href ?? '' };
  if (kind === 'font') {
    const a: Record<string, string> = {};
    if (attrs?.family) a.family = attrs.family;
    if (attrs?.size) a.size = attrs.size;
    return a;
  }
  if (kind === 'fg' || kind === 'bg') return { value: attrs?.value ?? '' };
  return undefined;
}

// The marks a PM block node wants, as char ranges (adjacent same-mark runs merged).
function nodeMarks(node: PmNode): CharMark[] {
  const out: CharMark[] = [];
  let pos = 0;
  node.forEach((child) => {
    const len = child.text?.length ?? child.nodeSize;
    for (const m of child.marks) {
      const kind = omegaMarkKind(m);
      if (!kind) continue;
      const attrs = markAttrs(kind, m);
      const prev = out.find((r) => r.kind === kind && r.to === pos && sameAttrs(r.attrs, attrs));
      if (prev) prev.to = pos + len;
      else out.push({ kind, from: pos, to: pos + len, attrs });
    }
    pos += len;
  });
  return out;
}

// A snapshot block's marks, converted to char ranges (for comparison).
function blockCharMarks(block: Block): CharMark[] {
  const atoms = block.atoms ?? [];
  const starts = new Map<string, number>();
  let acc = 0;
  for (const a of atoms) {
    starts.set(a.id, acc);
    acc += a.text.length;
  }
  const out: CharMark[] = [];
  for (const m of block.marks ?? []) {
    const from = anchorChar(atoms, starts, m.start);
    const to = anchorChar(atoms, starts, m.end);
    if (from == null || to == null || to <= from) continue;
    out.push({ kind: m.kind, from, to, attrs: markAttrsFromDoc(m.kind, m.attrs) });
  }
  return out;
}

const markKey = (r: CharMark) => `${r.kind}:${r.from}:${r.to}:${attrsKey(r.attrs)}`;
function sameMarks(a: CharMark[], b: CharMark[]): boolean {
  if (a.length !== b.length) return false;
  const as = a.map(markKey).sort();
  const bs = b.map(markKey).sort();
  return as.every((k, i) => k === bs[i]);
}

// Materialize desired char-range marks as Omega marks over the given atoms.
function toDocMarks(desired: CharMark[], atoms: Atom[]): DocMark[] {
  const out: DocMark[] = [];
  for (const r of desired) {
    if (r.to <= r.from) continue;
    const start = charToAnchor(atoms, r.from, 'start');
    const end = charToAnchor(atoms, r.to, 'end');
    if (!start || !end) continue;
    out.push({ id: newUnitId(), kind: r.kind, ...(r.attrs ? { attrs: r.attrs } : {}), start, end });
  }
  return out;
}

// Convert a PM list_item to an Omega ListItem (single-atom write model, marks kept).
function itemFromNode(li: PmNode): ListItem {
  const text = li.textContent;
  const atoms: Atom[] = text ? [{ id: newUnitId(), kind: 'text', text }] : [];
  const marks = atoms.length ? toDocMarks(nodeMarks(li), atoms) : [];
  return {
    level: Number(li.attrs.level) || 0,
    ...(li.attrs.checked ? { checked: true } : {}),
    atoms,
    ...(marks.length ? { marks } : {})
  };
}

// Build a full ListBlockData payload from a PM `list` node.
function listDataFromNode(node: PmNode): ListBlockData {
  const items: ListItem[] = [];
  node.forEach((li) => items.push(itemFromNode(li)));
  const start = Number(node.attrs.start) || 1;
  return {
    type: (node.attrs.listType as ListBlockData['type']) ?? 'bullet',
    ...(start !== 1 ? { start } : {}),
    items
  };
}

// A structural signature of a list payload (ignores volatile atom ids), so an
// unchanged list re-diffs to no op.
function listSignature(data: ListBlockData | undefined): string {
  return JSON.stringify({
    type: data?.type ?? 'bullet',
    start: data?.start ?? 1,
    items: (data?.items ?? []).map((it) => ({
      level: it.level ?? 0,
      checked: !!it.checked,
      text: (it.atoms ?? []).map((a) => a.text).join(''),
      marks: (it.marks ?? [])
        .map((m) => `${m.kind}:${m.start.offset}:${m.end.offset}:${attrsKey(m.attrs)}`)
        .sort()
    }))
  });
}

export type DiffResult = {
  /** Ops to append (empty when nothing changed). */
  ops: ChangeOp[];
  /** The predicted snapshot after the ops apply — becomes prevRows on success. */
  nextRows: Row[];
  /** blockId/rowId attrs to stamp onto nodes, keyed by top-level child index. */
  fixups: Map<number, { blockId: string; rowId: string }>;
};

/**
 * Diff the last-synced rows against the current ProseMirror doc, block-level:
 * matched by blockId attr; nodes with no id (or a duplicated id, from a split)
 * become a new row containing that block; missing ids become delete_block or,
 * when the last block leaves, delete_row; text changes become atom ops; mark
 * changes become remove_mark/add_mark rewrites; kind-attr changes become
 * set_block. Ops are ordered deletes-first, then inserts/sets in document order
 * (and per block: mark removals before atom ops), so every op's target exists
 * when it applies.
 */
export function diffDoc(prevRows: Row[], doc: PmNode): DiffResult {
  const prev = new Map<string, { block: Block; rowId: string }>();
  const previousRows = new Map(prevRows.map((row) => [row.id, row]));
  for (const r of prevRows) for (const b of r.blocks) prev.set(b.id, { block: b, rowId: r.id });

  type Item = {
    index: number;
    id: string;
    isNew: boolean;
    kind: BlockKind;
    subKind: string | undefined;
    text: string;
    node: PmNode;
    rowId: string;
    attrId: string | null;
    attrRow: string | null;
  };
  const items: Item[] = [];
  const seen = new Set<string>();
  doc.forEach((node, _offset, index) => {
    const attrId = (node.attrs.blockId as string | null) ?? null;
    const id = attrId && !seen.has(attrId) ? attrId : newUnitId();
    seen.add(id);
    items.push({
      index,
      id,
      isNew: !prev.has(id),
      kind: nodeKind(node),
      subKind: nodeSubKind(node),
      text: node.textContent,
      node,
      rowId: '',
      attrId,
      attrRow: (node.attrs.rowId as string | null) ?? null
    });
  });

  const ops: ChangeOp[] = [];

  // Deletions first: remove an entire row when its final block disappeared,
  // otherwise remove only the missing children. Anchors below then resolve
  // against this post-delete row order.
  const kept = new Set(items.map((i) => i.id));
  const rowOrder = prevRows.map((r) => r.id);
  for (const row of prevRows) {
    const removed = row.blocks.filter((block) => !kept.has(block.id));
    if (removed.length === 0) continue;
    if (removed.length === row.blocks.length) {
      ops.push({ op: 'delete_row', rowId: row.id });
      rowOrder.splice(rowOrder.indexOf(row.id), 1);
    } else {
      for (const block of removed) ops.push({ op: 'delete_block', blockId: block.id });
    }
  }

  // Every top-level node created by Enter or paste receives a fresh row. A
  // multi-block row is a deliberate column layout, never an accidental split.
  const rowInsertAfter = new Map<number, string>();
  const rowFor = (i: number): string => {
    const it = items[i];
    if (!it.isNew) return prev.get(it.id)!.rowId;
    const rowId = newUnitId();
    const previousRow = i > 0 ? items[i - 1].rowId : '';
    const previousIndex = previousRow ? rowOrder.indexOf(previousRow) : -1;
    const insertAt = previousIndex >= 0 ? previousIndex + 1 : 0;
    const afterRow = insertAt > 0 ? rowOrder[insertAt - 1] : '';
    rowOrder.splice(insertAt, 0, rowId);
    rowInsertAfter.set(i, afterRow);
    return rowId;
  };

  const fixups = new Map<number, { blockId: string; rowId: string }>();
  const nextBlocksByRow = new Map<string, Block[]>();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    it.rowId = rowFor(i);
    let nextBlock: Block;

    if (it.kind === 'list') {
      // A list carries its items as typed data; any change is a whole-payload
      // set_block_data (all list ops invert to that anyway).
      const listData = listDataFromNode(it.node);
      if (it.isNew) {
        nextBlock = {
          id: it.id,
          kind: 'list',
          style: { horizontalAlign: 'left', verticalAlign: 'top' },
          atoms: [],
          data: listData
        };
        ops.push({
          op: 'insert_row',
          afterRow: rowInsertAfter.get(i) ?? '',
          row: { id: it.rowId, style: { heightIncrease: 0 }, blocks: [nextBlock] }
        });
      } else {
        const pb = prev.get(it.id)!.block;
        if (listSignature(listData) !== listSignature(pb.data as ListBlockData | undefined))
          ops.push({ op: 'set_block_data', blockId: it.id, listData });
        nextBlock = { ...pb, kind: 'list', subKind: undefined, data: listData };
      }
    } else if (it.isNew) {
      // Leaf kinds (divider, image) carry no atoms; text kinds get a single atom.
      const leaf = isLeafKind(it.kind);
      const newAtoms: Atom[] = leaf ? [] : [{ id: newUnitId(), kind: 'text', text: it.text }];
      const newMarks = leaf ? [] : toDocMarks(nodeMarks(it.node), newAtoms);
      nextBlock = {
        id: it.id,
        kind: it.kind,
        ...(it.subKind ? { subKind: it.subKind } : {}),
        style: { horizontalAlign: 'left', verticalAlign: 'top' },
        atoms: newAtoms,
        ...(newMarks.length ? { marks: newMarks } : {})
      };
      ops.push({
        op: 'insert_row',
        afterRow: rowInsertAfter.get(i) ?? '',
        row: { id: it.rowId, style: { heightIncrease: 0 }, blocks: [nextBlock] }
      });
    } else {
      const pb = prev.get(it.id)!.block;
      let atoms = pb.atoms ?? [];
      let marks = pb.marks;
      const prevText = atoms.map((a) => a.text).join('');
      const textChanged = it.text !== prevText;
      // Marks are rewritten whole (remove all, re-add the desired set) whenever
      // the text changed (positions shift; the PM node knows the truth) or the
      // desired set differs. remove_mark ops MUST precede the atom ops — the
      // server sanitizes marks on text/atom changes, and removing an
      // already-sanitized mark would 409 the whole change set.
      const desired = nodeMarks(it.node);
      const marksChanged = textChanged
        ? desired.length > 0 || (pb.marks ?? []).length > 0
        : !sameMarks(desired, blockCharMarks(pb));
      if (marksChanged)
        for (const m of pb.marks ?? []) ops.push({ op: 'remove_mark', blockId: it.id, markId: m.id });
      if (textChanged) {
        if (atoms.length === 0) {
          const atom: Atom = { id: newUnitId(), kind: 'text', text: it.text };
          ops.push({ op: 'insert_atom', blockId: it.id, afterAtom: '', atom });
          atoms = [atom];
        } else {
          // Single-atom write model: consolidate, then set the full text.
          for (const extra of atoms.slice(1))
            ops.push({ op: 'delete_atom', blockId: it.id, atomId: extra.id });
          ops.push({ op: 'set_atom_text', blockId: it.id, atomId: atoms[0].id, setText: it.text });
          atoms = [{ ...atoms[0], text: it.text }];
        }
      }
      if (marksChanged) {
        const newMarks = toDocMarks(desired, atoms);
        for (const m of newMarks) ops.push({ op: 'add_mark', blockId: it.id, mark: m });
        marks = newMarks.length ? newMarks : undefined;
      }
      let kind = pb.kind;
      // A node's kind attr only ever changes deliberately (typing never touches
      // it) — including into/out of `prompt`/`callout`, which the inspector sets.
      if (it.kind !== pb.kind) {
        ops.push({ op: 'set_block', blockId: it.id, setKind: it.kind });
        kind = it.kind;
      }
      // A text block's sub-kind (body ↔ heading_N ↔ custom) converts in place via
      // set_block_subkind. A set_block into `text` already defaults the sub-kind to
      // `body`, so only emit when the target differs from that effective value.
      const subKind = it.kind === 'text' ? it.subKind || 'body' : undefined;
      if (it.kind === 'text') {
        const effectivePrev = it.kind !== pb.kind ? 'body' : pb.subKind || 'body';
        if (subKind !== effectivePrev)
          ops.push({ op: 'set_block_subkind', blockId: it.id, setSubKind: subKind });
      }
      // A kind change to a non-data kind must not carry the old typed data
      // (Omega self-heals on reload; keep the local snapshot clean meanwhile).
      const data = it.kind !== pb.kind && !isDataKind(it.kind) ? undefined : pb.data;
      nextBlock = { ...pb, kind, subKind, atoms, marks, data };
    }

    if (it.attrId !== it.id || it.attrRow !== it.rowId)
      fixups.set(it.index, { blockId: it.id, rowId: it.rowId });
    const arr = nextBlocksByRow.get(it.rowId) ?? [];
    arr.push(nextBlock);
    nextBlocksByRow.set(it.rowId, arr);
  }

  const nextRows: Row[] = rowOrder.map((id) => ({
    id,
    style: previousRows.get(id)?.style ?? { heightIncrease: 0 },
    blocks: nextBlocksByRow.get(id) ?? []
  }));
  return { ops, nextRows, fixups };
}
