# src/lib/features/stages/document/editor/bridge.ts — breakdown

Companion to [bridge.ts](bridge.ts). The Omega↔ProseMirror bridge. `omegaToPmDoc` renders a resolved document into a ProseMirror doc — rows flattened into block nodes, byte-offset mark anchors mapped to character ranges. `diffDoc` compares the last-synced snapshot against the current PM doc and produces the id-addressed change ops, the predicted next snapshot, and the blockId/rowId attr fix-ups for nodes ProseMirror created. Lists round-trip through a real `list` node; marks are compared in block-global character space through a shared `CharMark` shape.

## Imports

### ProseMirror model types, the editor schema, and the Omega document vocabulary the bridge maps between

```ts
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

```

The bridge imports ProseMirror's `Mark` and `Node` types and the editor `schema`, plus the Omega document vocabulary from `$data/documents` — the `newUnitId` id factory, the `isDataKind`/`isLeafKind`/`headingLevel`/`subKindForLevel` classifiers, and the `Atom`/`Anchor`/`Block`/`Row` family of types. Everything either direction of the bridge needs to name is pulled in here.

## Module overview

### What the bridge does, and the write model diffDoc follows

```ts
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

```

The file's contract stated up front: `omegaToPmDoc` renders a resolved document into a ProseMirror doc, and `diffDoc` turns edits back into id-addressed change ops. The write model is deliberately simple — each block's text is a single atom (multi-atom blocks consolidate on edit) and marks are rewritten whole per block from the PM node, which already tracks their positions through text edits. Block reordering is intentionally not detected, because there is no reorder UI yet.

## Byte ↔ character offset conversion

### byteToChar and its inverse charToByte, walked one code point at a time

```ts
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

```

Omega stores mark anchors as UTF-8 byte offsets, but JavaScript strings are UTF-16, so every anchor crossing the boundary is converted. `byteToChar` walks the string a code point at a time, adding 1–4 bytes per character until it reaches the target byte, and returns the accumulated UTF-16 length; `charToByte` is the exact inverse. Both stop as soon as the running counter reaches the requested offset.

## Character position → atom anchor

### charToAnchor resolves a block-global char position to an { atomId, byte offset } anchor

```ts
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

```

`charToAnchor` turns a block-global character position into an Omega anchor — the atom it lands in plus a byte offset within that atom. It scans atoms accumulating lengths; the `side` flag decides tie-breaking at an atom boundary, so a `start` anchor opens in the later atom and an `end` anchor closes in the earlier one, keeping a range strictly inside the atoms it covers. The in-atom character offset is clamped and converted back to bytes via `charToByte`.

## Omega → ProseMirror: mark construction

### pmMarkFor builds a ProseMirror mark for an Omega mark kind, carrying its attrs

```ts
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

```

Opening the Omega → ProseMirror direction, `pmMarkFor` maps an Omega mark kind to a freshly created ProseMirror mark. Formatting marks (bold/italic/underline/strike/code) create bare marks; `link`, `font`, `fg`, and `bg` carry their attrs across (href, family/size, value), each defaulting to an empty string. An unknown kind returns `null` and is skipped by callers.

## Anchor → character position

### anchorChar gives an Omega anchor's char position within the block's concatenated text

```ts
// Character position of an anchor within the block's concatenated text.
function anchorChar(atoms: Atom[], starts: Map<string, number>, a: Anchor): number | null {
  const atom = atoms.find((x) => x.id === a.atomId);
  if (!atom) return null;
  return (starts.get(atom.id) ?? 0) + byteToChar(atom.text, a.offset);
}

```

`anchorChar` is the read-direction counterpart to `charToAnchor`: given an anchor, it finds the owning atom, looks up that atom's start offset in the precomputed `starts` map, and adds the byte→char conversion of the anchor's offset. It returns `null` when the anchor points at an atom that is not present.

## Inline content from atoms + marks

### inlineContentFrom segments text at mark boundaries; inlineContent adapts a Block

```ts
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

```

`inlineContentFrom` builds a block's inline content by cutting the concatenated atom text into runs at every mark boundary. It resolves each Omega mark to a char range and a PM mark, collects the sorted set of range boundaries, and emits one text node per segment carrying exactly the marks that cover it; an unmarked block short-circuits to a single text node. `inlineContent` is the thin adapter that feeds a `Block`'s atoms and marks in. Sharing this helper is what lets text blocks and list items render marks identically.

## Image leaf label

### A fixed placeholder label for the round-trip-only image block

```ts
// A read-only placeholder label for an image block (round-trip only).
function leafLabel(): string {
  return 'Image';
}

```

A constant placeholder string for image blocks, which are not yet editable inline. It exists only so the block node has a visible label while round-tripping its typed data.

## Building a list node

### listNode renders a block's ListBlockData as a list of list_item nodes

```ts
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

```

`listNode` renders a list block's `ListBlockData` as a ProseMirror `list` node, one `list_item` per item (each carrying its `level`/`checked` attrs and its own inline content via the shared helper). The list node preserves `listType` and `start` on its attrs, and an empty list still gets a single empty `list_item` so the node stays schema-valid.

## Building a block node

### blockNode maps each Omega block kind to its ProseMirror node

```ts
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

```

`blockNode` is the per-block dispatch: a `text` block becomes a `heading` node when its sub-kind maps to a level, otherwise a `paragraph` carrying its `kind`/`subKind` attrs; `code` becomes a marks-free `code_block`; `divider` a contentless leaf; `list` delegates to `listNode`; `image` becomes a round-tripping `block_leaf` placeholder. `callout` and `prompt` reuse the paragraph node but keep their true `kind` attr so the differ can round-trip them.

## Rendering the whole document

### omegaToPmDoc flattens every row's blocks into a single vertical doc

```ts
/** Render a resolved Omega document as a ProseMirror doc (rows flattened). */
export function omegaToPmDoc(doc: Doc): PmNode {
  const children: PmNode[] = [];
  for (const row of doc.base.rows) for (const b of row.blocks) children.push(blockNode(b, row.id));
  if (children.length === 0) children.push(schema.node('paragraph'));
  return schema.node('doc', null, children);
}

```

The exported entry point flattens the document: every block of every row is pushed, in order, as a top-level child, discarding the row grouping (which `diffDoc` reconstructs). An empty document falls back to a single empty paragraph so ProseMirror always has a valid doc.

## ProseMirror → change ops: node kind

### nodeKind reads the Omega block kind a PM node stands for

```ts
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

```

Opening the reverse direction, `nodeKind` reports the Omega block kind a PM node represents. Structural node types map directly (`heading`/`code_block`/`divider`/`list`); a `block_leaf` or `paragraph` reads its `kind` attr, defaulting to `image` or `text`. A heading always reports `text` because its level lives in the sub-kind.

## Node sub-kind

### nodeSubKind reads a text node's sub-kind (heading level, or body/custom)

```ts
/** The text sub-kind a node represents, or `undefined` for a non-text kind. A
 *  heading node's level maps to `heading_N`; a text paragraph carries its
 *  `subKind` attr (defaulting `body`). */
export function nodeSubKind(node: PmNode): string | undefined {
  if (node.type.name === 'heading') return subKindForLevel(node.attrs.level as number);
  if (node.type.name === 'paragraph' && node.attrs.kind === 'text')
    return (node.attrs.subKind as string) || 'body';
  return undefined;
}

```

`nodeSubKind` returns the text sub-kind for a node, or `undefined` for non-text kinds. A heading maps its level back to `heading_N`; a text paragraph returns its `subKind` attr (defaulting `body`). Everything else has no sub-kind.

## Marks in character space: the CharMark type

### The intermediate mark representation both sides convert through

```ts
// --- marks: PM node ↔ Omega, in block-global character space -----------------

type CharMark = { kind: MarkKind; from: number; to: number; attrs?: Record<string, string> };

```

The marks section works in a single intermediate representation: a `CharMark` is a mark kind plus a `[from, to)` character range and optional attrs. Both the PM node and the stored snapshot convert into this shape so they can be compared and materialized uniformly.

## PM mark kind → Omega mark kind

### omegaMarkKind maps a ProseMirror mark type name to its Omega kind

```ts
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

```

`omegaMarkKind` is the inverse of `pmMarkFor`'s kind switch: it maps a ProseMirror mark type name back to the Omega mark kind (`strong`→`bold`, `em`→`italic`, and so on), returning `null` for any mark type the bridge does not model.

## Mark attrs from a PM mark

### markAttrs extracts the Omega attrs a PM mark carries, dropping empty fields

```ts
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

```

`markAttrs` extracts the Omega attrs a PM mark should store: `link` keeps its href, `font` keeps whichever of family/size are set, `fg`/`bg` keep their value. Empty fields are omitted so that two marks compare equal whenever their meaningful styling matches.

## Attr comparison helpers

### attrsKey canonicalizes an attrs object; sameAttrs compares two by that key

```ts
const attrsKey = (a?: Record<string, string>) =>
  JSON.stringify(a ? Object.fromEntries(Object.entries(a).sort()) : {});
const sameAttrs = (a?: Record<string, string>, b?: Record<string, string>) =>
  attrsKey(a) === attrsKey(b);

```

`attrsKey` canonicalizes an attrs object to a stable JSON string (keys sorted, absent treated as empty), and `sameAttrs` compares two attrs by that key. Sorting keys makes the comparison independent of property order.

## Mark attrs from a stored DocMark

### markAttrsFromDoc normalizes a snapshot mark's attrs the same way as markAttrs

```ts
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

```

`markAttrsFromDoc` performs the same normalization as `markAttrs` but reads from a stored `DocMark`'s attrs rather than a live PM mark. Running both sides through matching normalizers is what lets a snapshot mark and a PM mark compare equal when they carry the same styling.

## Desired marks from a PM node

### nodeMarks collects a node's marks as merged char ranges

```ts
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

```

`nodeMarks` collects the marks a PM block node wants as char ranges. It walks the node's inline children accumulating positions, and for each mark extends an adjacent same-kind/same-attrs run when possible or starts a new range — merging runs so the result matches how Omega stores contiguous marks.

## Snapshot marks as char ranges

### blockCharMarks converts a stored block's marks to char ranges for comparison

```ts
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

```

`blockCharMarks` is the snapshot-side equivalent: it converts a stored block's marks into the same `CharMark` char-range shape, resolving each anchor to a character position via `anchorChar` and normalizing attrs with `markAttrsFromDoc`. Degenerate or unresolvable ranges are dropped.

## Comparing two mark sets

### markKey keys a CharMark; sameMarks tests set equality order-independently

```ts
const markKey = (r: CharMark) => `${r.kind}:${r.from}:${r.to}:${attrsKey(r.attrs)}`;
function sameMarks(a: CharMark[], b: CharMark[]): boolean {
  if (a.length !== b.length) return false;
  const as = a.map(markKey).sort();
  const bs = b.map(markKey).sort();
  return as.every((k, i) => k === bs[i]);
}

```

`markKey` serializes a `CharMark` (kind, range, attrs key) and `sameMarks` uses it to test whether two mark sets are equal regardless of order — sort both keyed lists and compare element-wise. This is the equality the differ uses to decide whether a block's marks changed.

## Char ranges → Omega marks

### toDocMarks materializes desired char-range marks as anchored DocMarks

```ts
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

```

`toDocMarks` materializes desired char ranges as Omega `DocMark`s over a concrete atom list: each range's endpoints become anchors via `charToAnchor`, a fresh id is minted, and attrs are attached only when present. Empty or unresolvable ranges are skipped.

## PM list_item → Omega ListItem

### itemFromNode converts one list item (single-atom write model, marks kept)

```ts
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

```

`itemFromNode` converts a PM `list_item` into an Omega `ListItem`, following the single-atom write model — the item's text becomes one atom (or none when empty) and its marks are re-derived over that atom. `level` is always written; `checked` and `marks` only when meaningful.

## PM list node → ListBlockData

### listDataFromNode builds the full typed list payload from a list node

```ts
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

```

`listDataFromNode` assembles a full `ListBlockData` from a PM `list` node by converting each item and reading `listType`/`start` from the node attrs. `start` is omitted when it is the default 1, keeping the payload minimal.

## List structural signature

### listSignature: an id-independent signature so an unchanged list re-diffs to nothing

```ts
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

```

`listSignature` produces an id-independent JSON signature of a list payload — type, start, and each item's level/checked/text plus a sorted, byte-offset view of its marks. Because it ignores the volatile atom ids that `listDataFromNode` mints on every diff, an otherwise-unchanged list produces an identical signature and so emits no op.

## The DiffResult type

### What diffDoc returns: ops, the predicted next snapshot, and node attr fix-ups

```ts
export type DiffResult = {
  /** Ops to append (empty when nothing changed). */
  ops: ChangeOp[];
  /** The predicted snapshot after the ops apply — becomes prevRows on success. */
  nextRows: Row[];
  /** blockId/rowId attrs to stamp onto nodes, keyed by top-level child index. */
  fixups: Map<number, { blockId: string; rowId: string }>;
};

```

The `diffDoc` return type bundles three things: the `ops` to append (empty when nothing changed), the predicted `nextRows` snapshot that becomes the new `prevRows` once the submission succeeds, and `fixups` — the blockId/rowId attrs to stamp back onto nodes ProseMirror created without them, keyed by top-level child index.

## diffDoc: prior-snapshot index

### Doc-comment, signature, and the blockId → { block, rowId } lookup

```ts
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

```

`diffDoc` opens by indexing the prior snapshot: `previousRows` by row id, and `prev` mapping every block id to its block and owning row. The doc-comment states the whole strategy — match by blockId, treat missing or duplicated ids as structural changes, and order ops deletes-first so every op's target exists when it applies.

## diffDoc: collecting the current nodes

### The Item shape and one pass over the PM doc's top-level nodes

```ts
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

```

A local `Item` captures everything the loop needs about each current top-level node. One pass over the PM doc builds the `items` list, reusing each node's `blockId` attr as its id unless it is absent or already `seen` (a duplicate from an Enter/paste split), in which case a fresh id is minted. `isNew` records whether that id existed in the prior snapshot.

## diffDoc: deletions

### Emit delete_row / delete_block for blocks no longer present, before anything else

```ts
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

```

Deletions are emitted first, so later anchors resolve against the post-delete row order. For each prior row, blocks whose ids are no longer kept are collected; if the whole row disappeared it becomes a single `delete_row` (and drops out of `rowOrder`), otherwise each missing block becomes a `delete_block`.

## diffDoc: new-row assignment

### rowFor gives every brand-new node a fresh row; the fixups / next-blocks maps

```ts
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

```

Every brand-new top-level node gets its own fresh row — a multi-block row means a deliberate column layout, never an accidental split. `rowFor` returns an existing block's current row, or for a new node mints a row id and splices it into `rowOrder` right after the previous node's row, recording the `afterRow` for the eventual `insert_row`. The `fixups` and `nextBlocksByRow` accumulators are set up alongside it.

## diffDoc: the build loop — list branch

### Per node, a list block emits insert_row (new) or a whole-payload set_block_data

```ts
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
```

The main loop assigns each item's row and then branches on kind. A `list` item rebuilds its typed payload with `listDataFromNode`; when new it emits an `insert_row` carrying the list block, and when existing it emits a whole-payload `set_block_data` only if the structural `listSignature` changed. Either way the predicted next block is recorded.

## diffDoc: the build loop — new block branch

### A brand-new non-list node becomes an insert_row carrying a fresh block

```ts
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
```

A brand-new non-list node becomes an `insert_row`. Leaf kinds (divider, image) carry no atoms; text kinds get a single atom and marks derived from the node. The assembled block — with sub-kind and marks attached only when present — is both pushed as the op's row content and kept as the predicted next block.

## diffDoc: the build loop — existing block

### Diff the text, marks, kind, and sub-kind of a matched block into ordered ops

```ts
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

```

The matched-block branch diffs content into ordered ops. Marks are rewritten whole (remove-all then re-add) whenever the text changed or the desired set differs, and the `remove_mark`s are emitted before any atom op because Omega sanitizes marks on text changes and removing an already-sanitized mark would 409 the batch. Text changes consolidate to the single-atom write model (`insert_atom`, or delete-extras plus `set_atom_text`); a deliberate kind change emits `set_block`, and a text block's sub-kind change emits `set_block_subkind` only when it differs from the effective post-change value. Typed data is dropped when the kind changes to a non-data kind.

## diffDoc: fix-ups and next rows

### Record attr fix-ups, group blocks by row, then build the predicted snapshot

```ts
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
```

After the branch, a node whose blockId or rowId attr does not already match its resolved ids is queued as a fix-up, and its predicted block is appended to its row's bucket. Once every item is processed, `nextRows` is rebuilt from `rowOrder` — preserving each surviving row's style and its accumulated blocks — and returned alongside the ops and fix-ups.
