# A2 Block Kinds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Omega's `code`, `callout`, and `divider` block kinds to the document editor and redesign the inspector around **Insert element** + a collapsible **Extra formatting** (Text type + Line spacing), then strip the Layout panel's rejected semantic-typography controls.

**Architecture:** A `block-kinds.ts` registry is the single source of truth for kind metadata (label, group, node shape). The ProseMirror schema is **hybrid** — `callout`/`quote` reuse the existing `paragraph` node via its `kind` attr; `code`→a new `code_block` node (`text*`, no marks); `divider`→a new leaf node. The Omega↔PM bridge maps the new nodes and teaches the diff two rules (no atoms for leaf kinds; drop stale `data` on a kind change). Two new runtime actions — `setTextType` (whole-line convert) and `insertElement` (insert a new element block) — drive the redesigned inspector.

**Tech Stack:** SvelteKit + Svelte 5 runes, ProseMirror (`prosemirror-model`/`-state`/`-view`), TypeScript, Vitest, Tailwind v4. Backend: Taurus Omega (Go), changesets via `POST /documents/:id/changes`.

## Global Constraints

- **Nothing mocked** — un-mock against Omega or hide; never fake data.
- **Companions (Practice 1):** every touched hand-authored file (`*.ts`, `*.svelte`, `*.css`) has a `<file>.md` companion updated **in the same change**; the union of its fenced code blocks must reproduce the source **byte-for-byte**. Only `src/lib/components/` is exempt — the document-stage files here are **not**.
- **Change record (Practice 2):** one `docs/records/2026-07-25-<slug>.md` per commit.
- **Green gates:** `pnpm check` (svelte-check) and `pnpm test` (vitest) pass before every commit.
- **Omega verification:** round-trip each op against `:8444` (a fresh build) — these ops (`set_block`, `insert_block`, `delete_block`) predate the verify binary, so no rebuild. Use `node` (not `python3`) for JSON.
- **Svelte 5 runes** only (`$state`/`$derived`/`$props`/`$effect`). Match surrounding code's idiom.
- **Commit** directly to `main`; message trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Spec:** `docs/superpowers/specs/2026-07-25-a2-block-kinds-design.md` is the authority; this plan implements it.

---

## File Structure

| File | Responsibility | Commit |
| --- | --- | --- |
| `src/lib/systems/documents/types.ts` | `BlockKind` full 14 + `ImageData` type | 1 |
| `src/lib/systems/documents/block-kinds.ts` (new) | Kind metadata registry (SSOT) + derived option lists | 1 |
| `src/lib/systems/documents/block-kinds.test.ts` (new) | Registry unit tests | 1 |
| `src/lib/systems/documents/index.ts` | Barrel export of `block-kinds` | 1 |
| `src/lib/features/stages/document/editor/schema.ts` | `code_block` + `divider` nodes; paragraph `data-kind` toDOM | 1 |
| `src/lib/features/stages/document/editor/bridge.ts` | kind↔node mapping; diff data/atom rules | 1 |
| `src/lib/features/stages/document/editor/bridge.test.ts` (new) | Round-trip + diff unit tests | 1 |
| `src/lib/features/stages/document/DocumentStage.svelte` | Kind CSS (callout, quote, code, divider) | 1 |
| `src/lib/features/stages/document/runtime.ts` | `setTextType` + `insertElement` actions | 1 |
| `src/lib/features/stages/document/editor/session.ts` | `EditorActions` type: +`setTextType`/`insertElement` | 1 |
| `src/lib/features/stages/document/panels/DetailsPanel.svelte` | Insert-element + Extra-formatting + new-block typography | 2 |
| `src/lib/features/stages/document/panels/LayoutPanel.svelte` | Remove semantic typography sections | 3 |
| `src/lib/features/stages/document/runtime.ts` + `session.ts` | Remove unused semantic write actions | 3 |

Each `.ts`/`.svelte` above also has a `.md` companion updated in the same step (byte-verify).

---

# COMMIT 1 — Engine (kinds, schema, bridge, rendering, actions)

Deliverable: code/callout/divider round-trip through Omega and can be inserted/converted programmatically; unit tests green; svelte-check green. UI wiring is Commit 2.

### Task 1.1: Expand `BlockKind` and add `ImageData`

**Files:**
- Modify: `src/lib/systems/documents/types.ts` (the `BlockKind` union ~L17-25; add `ImageData` near `CustomTypography` ~L101)
- Modify: `src/lib/systems/documents/types.ts.md` (companion)

**Interfaces:**
- Produces: `BlockKind` now includes `'quote' | 'code' | 'divider' | 'callout' | 'list_item' | 'image'`; `type ImageData = { fileId: string; alt: string; width: number; height: number }`.

- [ ] **Step 1: Extend the union.** Replace the `BlockKind` union body so it reads:

```ts
export type BlockKind =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'heading_4'
  | 'heading_5'
  | 'heading_6'
  | 'quote'
  | 'code'
  | 'divider'
  | 'callout'
  | 'list_item'
  | 'image'
  | 'prompt';
```

- [ ] **Step 2: Add `ImageData`.** After the `CustomTypography` type, add (list uses the native `list` kind later, so no `ListData` here):

```ts
/** An image block's payload (mirrors Omega ImageData). Added for model
 *  completeness; image insert/render is deferred to its own pass. */
export type ImageData = { fileId: string; alt: string; width: number; height: number };
```

- [ ] **Step 3: Update the companion** `types.ts.md` — extend the `BlockKind` fenced block to the full union and add a fenced block + prose for `ImageData`. Re-verify the companion reproduces the file (see Appendix A).

- [ ] **Step 4: Verify.** Run `pnpm check`. Expected: no new type errors (existing `switch`/lookups over `BlockKind` may now surface "not all cases handled" — those are fixed in 1.2/1.4; if `pnpm check` flags a missing case in code you don't touch this task, note it and resolve it in the task that owns that file).

### Task 1.2: The `block-kinds.ts` registry (SSOT)

**Files:**
- Create: `src/lib/systems/documents/block-kinds.ts`
- Create: `src/lib/systems/documents/block-kinds.test.ts`
- Modify: `src/lib/systems/documents/index.ts` (add `export * from './block-kinds';`)
- Create: `src/lib/systems/documents/block-kinds.ts.md` (companion)
- Modify: `src/lib/systems/documents/index.ts.md` (companion)

**Interfaces:**
- Consumes: `BlockKind` (1.1).
- Produces: `blockKinds: Record<BlockKind, BlockKindMeta>`; `textTypeOptions: {value,label}[]`; `insertElementOptions: {value,label,icon}[]`; `isDataKind(k): boolean`; `isLeafKind(k): boolean`; `blockKindLabel(k): string`.

- [ ] **Step 1: Write the failing test** `block-kinds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { blockKinds, textTypeOptions, insertElementOptions, isDataKind, isLeafKind } from './block-kinds';
import type { BlockKind } from './types';

const ALL: BlockKind[] = [
  'paragraph','heading_1','heading_2','heading_3','heading_4','heading_5','heading_6',
  'quote','code','divider','callout','list_item','image','prompt'
];

describe('block-kinds registry', () => {
  it('has an entry for every BlockKind', () => {
    for (const k of ALL) expect(blockKinds[k]?.kind).toBe(k);
    expect(Object.keys(blockKinds).sort()).toEqual([...ALL].sort());
  });

  it('offers only Body + headings as text types, in order', () => {
    expect(textTypeOptions.map((o) => o.value)).toEqual([
      'paragraph','heading_1','heading_2','heading_3','heading_4','heading_5','heading_6'
    ]);
    expect(textTypeOptions[0].label).toBe('Body');
  });

  it('offers divider/code/callout/prompt as elements; not quote/list/image', () => {
    const els = insertElementOptions.map((o) => o.value);
    expect(els).toContain('divider');
    expect(els).toContain('code');
    expect(els).toContain('callout');
    expect(els).toContain('prompt');
    expect(els).not.toContain('quote');
    expect(els).not.toContain('list_item');
    expect(els).not.toContain('image');
  });

  it('marks data kinds and leaf kinds', () => {
    expect(isDataKind('prompt')).toBe(true);
    expect(isDataKind('list_item')).toBe(true);
    expect(isDataKind('image')).toBe(true);
    expect(isDataKind('paragraph')).toBe(false);
    expect(isDataKind('code')).toBe(false);
    expect(isLeafKind('divider')).toBe(true);
    expect(isLeafKind('image')).toBe(true);
    expect(isLeafKind('paragraph')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run `pnpm test -- block-kinds`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `block-kinds.ts`:

```ts
import type { Component } from 'svelte';
import {
  Code, FileText, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Image as ImageIcon, List, Minus, Quote, Sparkles, SquareStack
} from '@lucide/svelte';
import type { BlockKind } from './types';

/** Which inspector menu a kind belongs to. */
export type BlockKindGroup = 'text' | 'element';

/** Everything the editor/UI needs to know about a block kind, in one place. */
export type BlockKindMeta = {
  kind: BlockKind;
  label: string;
  /** Shown in a user-facing menu. quote/list_item/image are round-trip-only. */
  offered: boolean;
  group: BlockKindGroup;
  /** Holds atoms (text). */
  textBearing: boolean;
  /** A leaf node with no content (divider, image). */
  isLeaf: boolean;
  /** Carries typed Data in Omega (prompt, list_item, image). */
  dataKind: boolean;
  icon: Component;
};

const meta = (
  kind: BlockKind, label: string, group: BlockKindGroup, icon: Component,
  opts: Partial<Pick<BlockKindMeta, 'offered' | 'textBearing' | 'isLeaf' | 'dataKind'>> = {}
): BlockKindMeta => ({
  kind, label, group, icon,
  offered: opts.offered ?? true,
  textBearing: opts.textBearing ?? true,
  isLeaf: opts.isLeaf ?? false,
  dataKind: opts.dataKind ?? false
});

/** The single source of truth for block-kind metadata. */
export const blockKinds: Record<BlockKind, BlockKindMeta> = {
  paragraph: meta('paragraph', 'Body', 'text', FileText),
  heading_1: meta('heading_1', 'Heading 1', 'text', Heading1),
  heading_2: meta('heading_2', 'Heading 2', 'text', Heading2),
  heading_3: meta('heading_3', 'Heading 3', 'text', Heading3),
  heading_4: meta('heading_4', 'Heading 4', 'text', Heading4),
  heading_5: meta('heading_5', 'Heading 5', 'text', Heading5),
  heading_6: meta('heading_6', 'Heading 6', 'text', Heading6),
  // Render-only (markdown import emits quote); not offered as a choice.
  quote: meta('quote', 'Quote', 'text', Quote, { offered: false }),
  code: meta('code', 'Code', 'element', Code),
  divider: meta('divider', 'Divider', 'element', Minus, { textBearing: false, isLeaf: true }),
  callout: meta('callout', 'Callout', 'element', SquareStack),
  // Deferred to the native `list` kind; round-trip only.
  list_item: meta('list_item', 'List', 'element', List, { offered: false, dataKind: true }),
  // Deferred to the image pass; round-trip only.
  image: meta('image', 'Image', 'element', ImageIcon, { offered: false, textBearing: false, isLeaf: true, dataKind: true }),
  prompt: meta('prompt', 'Prompt (AI)', 'element', Sparkles, { dataKind: true })
};

export const ALL_BLOCK_KINDS = Object.keys(blockKinds) as BlockKind[];

const offeredOf = (group: BlockKindGroup) =>
  ALL_BLOCK_KINDS.filter((k) => blockKinds[k].offered && blockKinds[k].group === group);

/** Text-type dropdown options (Body + headings), in kind order. */
export const textTypeOptions = offeredOf('text').map((k) => ({ value: k, label: blockKinds[k].label }));

/** Insert-element menu options (divider, code, callout, prompt). */
export const insertElementOptions = offeredOf('element').map((k) => ({
  value: k, label: blockKinds[k].label, icon: blockKinds[k].icon
}));

export const isDataKind = (k: BlockKind) => blockKinds[k].dataKind;
export const isLeafKind = (k: BlockKind) => blockKinds[k].isLeaf;
export const blockKindLabel = (k: BlockKind) => blockKinds[k]?.label ?? k;
```

- [ ] **Step 4: Run tests, verify pass.** Run `pnpm test -- block-kinds`. Expected: PASS.
- [ ] **Step 5: Barrel export.** Add `export * from './block-kinds';` to `index.ts`.
- [ ] **Step 6: Companions.** Write `block-kinds.ts.md` (fenced blocks reproducing the file, in order, with prose) and update `index.ts.md`. Byte-verify (Appendix A).
- [ ] **Step 7: `pnpm check`** — expected clean.

### Task 1.3: Schema — `code_block` + `divider` nodes, paragraph `data-kind`

**Files:**
- Modify: `src/lib/features/stages/document/editor/schema.ts`
- Modify: `src/lib/features/stages/document/editor/schema.ts.md`

**Interfaces:**
- Produces: `schema.nodes.code_block`, `schema.nodes.divider`; `paragraph` toDOM emits `data-kind` when kind≠paragraph.

- [ ] **Step 1: Add the paragraph `data-kind` attr in toDOM.** Replace the paragraph node's `toDOM`:

```ts
      toDOM(node) {
        const kind = node.attrs.kind as string;
        return ['p', kind && kind !== 'paragraph' ? { 'data-kind': kind } : {}, 0];
      }
```

- [ ] **Step 2: Add `code_block` and `divider` nodes** to the `nodes` map (after `heading`, before `text`):

```ts
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { blockId: { default: null }, rowId: { default: null }, kind: { default: 'code' } },
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() {
        return ['pre', ['code', 0]];
      }
    },
    divider: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { blockId: { default: null }, rowId: { default: null }, kind: { default: 'divider' } },
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return ['hr'];
      }
    },
```

- [ ] **Step 3: Companion** `schema.ts.md` — split the new nodes into fenced blocks with prose (note `code`/`defining`/`marks:''` for code; `atom` for divider; the `data-kind` change). Byte-verify.
- [ ] **Step 4: `pnpm check`** — expected clean (the schema is used by the bridge in 1.4).

### Task 1.4: Bridge — mapping + diff rules (with tests)

**Files:**
- Modify: `src/lib/features/stages/document/editor/bridge.ts`
- Create: `src/lib/features/stages/document/editor/bridge.test.ts`
- Modify: `src/lib/features/stages/document/editor/bridge.ts.md`

**Interfaces:**
- Consumes: `schema` (1.3), `isDataKind`/`isLeafKind` (1.2).
- Produces: `blockNode` maps code→code_block, divider→divider; `nodeKind` maps code_block→'code', divider→'divider'; `diffDoc` emits no-atom blocks for leaf kinds and drops stale `data` on kind change.

- [ ] **Step 1: Write failing tests** `bridge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { omegaToPmDoc, diffDoc, nodeKind } from './bridge';
import { schema } from './schema';
import type { Doc, Row } from '$data/documents';

function doc(rows: Row[]): Doc {
  return {
    id: 'd', projectId: 'p', name: 'n',
    base: {
      pageLayout: { width: 612, height: 792, marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72 },
      layoutRules: { maxFontHeight: 24, minRowPadding: 4, maxHeightIncrease: 144 },
      styleRegistry: { definitions: [], defaults: [] },
      rows
    },
    creatorId: '', creatorName: '', createdAt: '', updatedAt: '', revision: 1,
    clientCapabilities: { canonicalLayout: true, revisionSubmissions: true }
  };
}
const row = (id: string, kind: string, text = '', data?: unknown): Row => ({
  id, style: { heightIncrease: 0 },
  blocks: [{ id: `b-${id}`, kind: kind as never, style: { horizontalAlign: 'left', verticalAlign: 'top' },
    atoms: text ? [{ id: `a-${id}`, kind: 'text', text }] : [], ...(data ? { data } : {}) }]
});

describe('omegaToPmDoc → node kinds', () => {
  it('maps code and divider to their own node types', () => {
    const pm = omegaToPmDoc(doc([row('r1', 'code', 'x = 1'), row('r2', 'divider')]));
    expect(pm.child(0).type.name).toBe('code_block');
    expect(nodeKind(pm.child(0))).toBe('code');
    expect(pm.child(1).type.name).toBe('divider');
    expect(nodeKind(pm.child(1))).toBe('divider');
  });
  it('maps callout/quote onto the paragraph node with a kind attr', () => {
    const pm = omegaToPmDoc(doc([row('r1', 'callout', 'note'), row('r2', 'quote', 'said')]));
    expect(pm.child(0).type.name).toBe('paragraph');
    expect(nodeKind(pm.child(0))).toBe('callout');
    expect(nodeKind(pm.child(1))).toBe('quote');
  });
});

describe('diffDoc — new element blocks', () => {
  it('inserts a divider with no atoms', () => {
    const before = omegaToPmDoc(doc([row('r1', 'paragraph', 'hello')]));
    // Append a divider node (blockId null → treated as new).
    const withDivider = before.type.create(null, [
      before.child(0),
      schema.node('divider')
    ]);
    const { ops } = diffDoc(doc([row('r1', 'paragraph', 'hello')]).base.rows, withDivider);
    const insert = ops.find((o) => o.op === 'insert_row');
    expect(insert?.row?.blocks[0].kind).toBe('divider');
    expect(insert?.row?.blocks[0].atoms).toEqual([]);
  });
  it('inserts a code block with atoms and no marks', () => {
    const before = omegaToPmDoc(doc([row('r1', 'paragraph', 'x')]));
    const codeNode = schema.node('code_block', null, schema.text('a = 1'));
    const withCode = before.type.create(null, [before.child(0), codeNode]);
    const { ops } = diffDoc(doc([row('r1', 'paragraph', 'x')]).base.rows, withCode);
    const insert = ops.find((o) => o.op === 'insert_row' && o.row?.blocks[0].kind === 'code');
    expect(insert?.row?.blocks[0].atoms?.[0].text).toBe('a = 1');
    expect(insert?.row?.blocks[0].marks ?? []).toEqual([]);
  });
});

describe('diffDoc — kind change drops stale data', () => {
  it('drops data when a data-kind block becomes a no-data kind', () => {
    const rows = doc([row('r1', 'prompt', 'out', { instruction: 'do' })]).base.rows;
    const pm = omegaToPmDoc(doc([row('r1', 'prompt', 'out', { instruction: 'do' })]));
    // Convert the prompt node to a paragraph (kind attr change).
    const para = schema.node('paragraph', { ...pm.child(0).attrs, kind: 'paragraph' }, pm.child(0).content);
    const next = pm.type.create(null, [para]);
    const { nextRows } = diffDoc(rows, next);
    expect(nextRows[0].blocks[0].kind).toBe('paragraph');
    expect(nextRows[0].blocks[0].data).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail.** `pnpm test -- bridge`. Expected: FAIL.

- [ ] **Step 3: Implement `blockNode`** — replace its body:

```ts
function blockNode(block: Block, rowId: string): PmNode {
  if (block.kind.startsWith('heading_')) {
    const level = Number(block.kind.slice('heading_'.length)) || 1;
    return schema.node('heading', { level, blockId: block.id, rowId }, inlineContent(block));
  }
  if (block.kind === 'code') {
    const text = (block.atoms ?? []).map((a) => a.text).join('');
    return schema.node('code_block', { blockId: block.id, rowId }, text ? schema.text(text) : []);
  }
  if (block.kind === 'divider') {
    return schema.node('divider', { blockId: block.id, rowId });
  }
  // paragraph, prompt, callout, quote, and any deferred kind render as paragraph.
  return schema.node('paragraph', { blockId: block.id, rowId, kind: block.kind }, inlineContent(block));
}
```

- [ ] **Step 4: Implement `nodeKind`** — replace its body:

```ts
export function nodeKind(node: PmNode): BlockKind {
  if (node.type.name === 'heading') return `heading_${node.attrs.level}` as BlockKind;
  if (node.type.name === 'code_block') return 'code';
  if (node.type.name === 'divider') return 'divider';
  return (node.attrs.kind as BlockKind) ?? 'paragraph';
}
```

- [ ] **Step 5: Diff — no atoms for leaf kinds.** In `diffDoc`, import `isDataKind, isLeafKind` from `$data/documents`. In the `it.isNew` branch, replace the `newAtoms`/`newMarks` construction:

```ts
      const leaf = isLeafKind(it.kind);
      const newAtoms: Atom[] = leaf ? [] : [{ id: newUnitId(), kind: 'text', text: it.text }];
      const newMarks = leaf ? [] : toDocMarks(nodeMarks(it.node), newAtoms);
```

- [ ] **Step 6: Diff — drop stale data on kind change.** In the `else` (existing block) branch, where `nextBlock = { ...pb, kind, atoms, marks }` is built, compute `data` and include it:

```ts
      // A kind change to a non-data kind must not carry the old typed data
      // (Omega self-heals on reload, but keep the local snapshot clean).
      const data = it.kind !== pb.kind && !isDataKind(it.kind) ? undefined : pb.data;
      nextBlock = { ...pb, kind, atoms, marks, data };
```

- [ ] **Step 7: Run tests, verify pass.** `pnpm test -- bridge`. Expected: PASS.
- [ ] **Step 8: Companion** `bridge.ts.md` — update the `blockNode`/`nodeKind` fenced blocks and the two diff snippets with prose. Byte-verify.
- [ ] **Step 9: `pnpm check` + full `pnpm test`** — expected clean/green.

### Task 1.5: Runtime actions — `setTextType` + `insertElement`

**Files:**
- Modify: `src/lib/features/stages/document/editor/session.ts` (the `EditorActions` type)
- Modify: `src/lib/features/stages/document/runtime.ts` (implement in the `actions` object)
- Modify: both companions (`session.ts.md`, `runtime.ts.md`)

**Interfaces:**
- Consumes: `schema` nodes (1.3), `isLeafKind`/`blockKinds` (1.2).
- Produces on `EditorActions`:
  - `setTextType(kind: BlockKind): void` — convert every block the selection touches to a text kind.
  - `insertElement(kind: BlockKind): void` — insert an element block at the current line.

- [ ] **Step 1: Add to the `EditorActions` type** in `session.ts` (near `setBlockKind`):

```ts
  /** Convert every block the current selection touches to a text-type kind
   *  (Body / Heading 1-6). Whole-line: one set_block per touched block. */
  setTextType(kind: BlockKind): void;
  /** Insert a new element block (divider / code / callout / prompt) at the
   *  current line — replaces an empty line, else inserts after it. */
  insertElement(kind: BlockKind): void;
```

- [ ] **Step 2: Implement `setTextType`** in `runtime.ts` `actions` (model it on the existing `setBlockKind`, but over the selection's blocks). Add a private helper and the action:

```ts
    // Convert one block node at `pos` to a text-type kind (in place).
    // (private method on DocumentRuntime, above `actions`)
    private convertBlockAt(tr: Transaction, pos: number, kind: BlockKind): Transaction {
      const node = tr.doc.nodeAt(pos);
      if (!node) return tr;
      const base = { blockId: node.attrs.blockId, rowId: node.attrs.rowId };
      return kind.startsWith('heading_')
        ? tr.setNodeMarkup(pos, schema.nodes.heading, { ...base, level: Number(kind.slice(8)) || 1 })
        : tr.setNodeMarkup(pos, schema.nodes.paragraph, { ...base, kind });
    }
```

```ts
    // (in the `actions` object)
    setTextType: (kind: BlockKind) => {
      const sel = this.state.selection;
      // Collect the top-level block positions the selection touches.
      const positions: number[] = [];
      this.state.doc.forEach((node, offset) => {
        if (offset < sel.to && offset + node.nodeSize > sel.from && node.isTextblock) positions.push(offset);
      });
      if (positions.length === 0) return;
      let tr = this.state.tr;
      // Apply high-to-low so earlier setNodeMarkup positions stay valid.
      for (const pos of positions.reverse()) tr = this.convertBlockAt(tr, pos, kind);
      tr.setMeta('taurus:keep-inspection', true);
      this.dispatch(tr);
      this.hooks?.focus?.();
    },
```

- [ ] **Step 3: Implement `insertElement`** in `runtime.ts` `actions`:

```ts
    insertElement: (kind: BlockKind) => {
      const sel = this.state.selection;
      if (sel.$from.depth < 1) return;
      const pos = sel.$from.before(1);
      const cur = this.state.doc.nodeAt(pos);
      if (!cur) return;
      const empty = cur.isTextblock && cur.textContent.length === 0;
      const build = (): PmNode => {
        if (kind === 'divider') return schema.node('divider');
        if (kind === 'code') return schema.node('code_block', null, []);
        // callout / prompt reuse the paragraph node with a kind attr.
        return schema.node('paragraph', { kind }, []);
      };
      const node = build();
      let tr = this.state.tr;
      if (kind === 'divider') {
        // A divider is a leaf; drop it in and leave a paragraph to type in.
        const trailing = schema.node('paragraph');
        if (empty) tr = tr.replaceWith(pos, pos + cur.nodeSize, [node, trailing]);
        else tr = tr.insert(pos + cur.nodeSize, [node, trailing]);
        const caret = (empty ? pos : pos + cur.nodeSize) + node.nodeSize + 1;
        tr = tr.setSelection(TextSelection.create(tr.doc, caret));
      } else if (empty) {
        // Replace the empty line with the (empty) text-bearing element; caret inside.
        tr = tr.setNodeMarkup(pos, node.type, node.attrs);
        tr = tr.setSelection(TextSelection.create(tr.doc, pos + 1));
      } else {
        tr = tr.insert(pos + cur.nodeSize, node);
        tr = tr.setSelection(TextSelection.create(tr.doc, pos + cur.nodeSize + 1));
      }
      tr.setMeta('taurus:keep-inspection', true);
      this.dispatch(tr.scrollIntoView());
      this.hooks?.focus?.();
    },
```

- [ ] **Step 4: Import `blockKinds`/`isLeafKind` if needed** and `type PmNode` (`import type { Node as PmNode } from 'prosemirror-model';`) at the top of `runtime.ts`. `TextSelection` is already imported.
- [ ] **Step 5: Companions** — update `session.ts.md` (the two new action doc-comments) and `runtime.ts.md` (the `convertBlockAt` helper + the two actions). Byte-verify.
- [ ] **Step 6: `pnpm check`** — expected clean.
- [ ] **Step 7: Omega round-trip verification** (see Appendix B): with a fresh `:8444` running, POST `insert_block` for divider (no atoms), code, callout, and a `set_block` to `heading_1`; re-read the doc; assert each block persisted with the right kind and (for divider) empty atoms. Record results in the change record.

### Task 1.6: Rendering — kind CSS

**Files:**
- Modify: `src/lib/features/stages/document/DocumentStage.svelte` (the `<style>` block, after the existing `.ProseMirror code` rule)
- Modify: `src/lib/features/stages/document/DocumentStage.svelte.md`

- [ ] **Step 1: Add the kind CSS** inside `<style>`:

```css
  .doc-editor :global(.ProseMirror [data-kind='quote']) {
    border-left: 3px solid var(--color-border-strong);
    padding-left: 0.75rem;
    color: var(--color-secondary);
    font-style: italic;
  }
  .doc-editor :global(.ProseMirror [data-kind='callout']) {
    border: 1px solid var(--color-border);
    background: var(--color-panel);
    border-radius: var(--radius-control, 6px);
    padding: 0.5rem 0.75rem;
  }
  .doc-editor :global(.ProseMirror pre) {
    font-family: var(--font-mono, monospace);
    font-size: 0.875em;
    background: var(--color-panel);
    border-radius: var(--radius-control, 6px);
    padding: 0.6rem 0.8rem;
    white-space: pre;
    overflow-x: auto;
  }
  .doc-editor :global(.ProseMirror hr) {
    border: none;
    border-top: 1px solid var(--color-border-strong);
    margin: 0.5rem 0;
  }
```

- [ ] **Step 2: Companion** `DocumentStage.svelte.md` — add the new CSS to the style fenced block(s) with prose. Byte-verify.
- [ ] **Step 3: `pnpm check`** — expected clean.

### Task 1.7: Commit 1

- [ ] **Step 1: Gates.** `pnpm check` clean; `pnpm test` green; every touched companion byte-verifies (Appendix A).
- [ ] **Step 2: Change record** `docs/records/2026-07-25-a2-block-kinds-engine.md` (Omega round-trip results included).
- [ ] **Step 3: Commit** to `main`:

```bash
git add src/lib/systems/documents src/lib/features/stages/document docs/records
git commit -m "A2 (1/3): code/callout/divider kinds — registry, schema, bridge, rendering" \
  -m "Adds the block-kinds registry (SSOT), code_block + divider PM nodes, bridge kind↔node mapping + diff rules (no atoms for leaf kinds, drop stale data on kind change), setTextType/insertElement runtime actions, and kind CSS. Verified insert_block/set_block round-trips on :8444." \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# COMMIT 2 — Inspector redesign

Deliverable: users can Insert element (divider/code/callout/prompt) on an empty line, convert lines with Text type, and format via a collapsible Extra formatting section; new-block shows full typography.

### Task 2.1: Inspector — Insert element, Text type, Extra formatting, new-block typography

**Files:**
- Modify: `src/lib/features/stages/document/panels/DetailsPanel.svelte`
- Modify: `src/lib/features/stages/document/panels/DetailsPanel.svelte.md`

**Interfaces:**
- Consumes: `textTypeOptions`, `insertElementOptions` (1.2); `actions.setTextType`, `actions.insertElement` (1.5); existing `typographyControls` snippet.

- [ ] **Step 1: Imports.** Replace the local `kindOptions` array with registry imports: `import { textTypeOptions, insertElementOptions } from '$data/documents';`. Remove the now-dead `kindOptions` const.

- [ ] **Step 2: Extra-formatting snippet.** Add a collapsible snippet holding **Text type** (only when the inspected block is a text kind) + the existing line-spacing control, and delete the mocked `LINE_SPACING_OPTIONS` Select from `typographyControls`. Sketch:

```svelte
{#snippet extraFormatting(showTextType: boolean, textKind: string)}
  <details class="border-t border-border pt-3">
    <summary class="cursor-pointer text-caption text-secondary">Extra formatting</summary>
    <div class="mt-2.5 space-y-2.5">
      {#if showTextType}
        <div class="space-y-1">
          <p class="text-caption text-secondary">Text type</p>
          <Select
            value={textKind}
            aria-label="Text type"
            options={textTypeOptions}
            size="sm"
            onchange={(e: Event) => $editorSession?.actions.setTextType((e.currentTarget as HTMLSelectElement).value as BlockKind)}
          />
          <p class="text-caption text-muted">Changes the whole line — applies to every selected line.</p>
        </div>
      {/if}
      {@render rowHeightControl(false)}
    </div>
  </details>
{/snippet}
```

- [ ] **Step 3: Insert-element control.** Add a snippet used in `new-block` mode:

```svelte
{#snippet insertElementControl()}
  <div class="space-y-1">
    <p class="text-caption text-secondary">Insert element</p>
    <Select
      value=""
      aria-label="Insert element"
      options={[{ value: '', label: 'Choose an element…' }, ...insertElementOptions]}
      size="sm"
      onchange={(e: Event) => {
        const v = (e.currentTarget as HTMLSelectElement).value as BlockKind;
        if (v) $editorSession?.actions.insertElement(v);
      }}
    />
  </div>
{/snippet}
```

- [ ] **Step 4: Rewire the mode blocks.**
  - `new-block`: render `insertElementControl()`, then `typographyControls()`, then `extraFormatting(true, selection.block.kind)`. (Replaces the bare kind `Select`.)
  - `new-text`: `typographyControls()` + `extraFormatting(isTextKind(selection.block.kind), selection.block.kind)`.
  - `run`: `typographyControls()` + `extraFormatting(true, /* first touched block kind */)`.
  - `block`: keep prompt/alignment/rowHeight/addColumn; add `extraFormatting(isTextKind(block.kind), block.kind)` for text kinds; drop the standalone kind `Select`.
  - Add a helper `const isTextKind = (k: string) => blockKinds[k as BlockKind]?.group === 'text';` (import `blockKinds`).

- [ ] **Step 4b: Split the color control into fg + bg** (per review). In `typographyControls`, replace the single "Color" popover with **Text** (foreground → `setFont({ color })`, real/backable) and **Background** (→ `setFont({ backgroundColor })`). `backgroundColor` needs the Omega field filed in `typography-defaults.md` §3; until it ships, show the bg control with a visible "pending backend" note (tracked, not hidden), and wire it live once the field lands. Extend `customTypographyCss` to emit `background-color` when set.

- [ ] **Step 5: Verify (no unit test — component).** `pnpm check` clean. Manual: open a doc; on a new empty line the inspector shows Insert element + typography + Extra formatting (Text type); pick Code → an empty code block appears; type in it; select 2 lines → Text type → Heading 2 converts both. Capture a screenshot via the Playwright harness if convenient.

- [ ] **Step 6: Companion** `DetailsPanel.svelte.md` — reflect the new snippets and rewired modes. Byte-verify.

### Task 2.2: Commit 2

- [ ] **Step 1: Gates** — `pnpm check` + `pnpm test` green; companion byte-verifies.
- [ ] **Step 2: Change record** `docs/records/2026-07-25-a2-inspector.md`.
- [ ] **Step 3: Commit** to `main`:

```bash
git add src/lib/features/stages/document docs/records
git commit -m "A2 (2/3): inspector — Insert element, Text type, Extra formatting" \
  -m "Redesigns the Details panel: Insert element on a new line, new-block gains full next-text typography, and a collapsible Extra formatting section (Text type + Line spacing) replaces the flat kind Select and the mocked line-spacing control." \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# COMMIT 3 — Layout cleanup

Deliverable: the Layout panel shows only Page + Margins; the rejected semantic-typography controls and their now-unused write actions are gone; rendering (internal registry reads) is unaffected.

### Task 3.1: Remove semantic typography from the Layout panel

**Files:**
- Modify: `src/lib/features/stages/document/panels/LayoutPanel.svelte`
- Modify: `src/lib/features/stages/document/panels/LayoutPanel.svelte.md`

- [ ] **Step 1: Delete the "Body default" and "Heading styles" sections** (the two `<section>`s using `kindTypography`/`setKindTypography`, plus the trailing "Body and heading defaults are semantic styles…" note). Keep Page + Margins.
- [ ] **Step 2: Remove now-dead script** — the `headingStylesOpen` state, `headingKinds`, `typographyOptions`, `kindTypography`, `setKindTypography`, and the `TYPOGRAPHY_TOKENS`/`kindDefaultTypography`/`SemanticTypography`/`StyleRegistry`/`registry`/`ChevronDown` imports/derivations no longer referenced. Run `pnpm check` to confirm nothing else uses them here.
- [ ] **Step 3: Companion** `LayoutPanel.svelte.md` — reflect the reduced panel. Byte-verify.
- [ ] **Step 4: `pnpm check`** — clean.

### Task 3.2: Remove the now-unused semantic write actions

**Files:**
- Modify: `src/lib/features/stages/document/runtime.ts` (+ `.md`)
- Modify: `src/lib/features/stages/document/editor/session.ts` (+ `.md`)

- [ ] **Step 1: Confirm no callers.** Run `grep -rn "setBlockKindTypography\|setBlockTypography" src/lib`. Expect only definitions (runtime.ts, session.ts) after Task 3.1/A1. If a component still calls one, stop and resolve that first.
- [ ] **Step 2: Delete the actions** `setBlockKindTypography` and `setBlockTypography` from `runtime.ts` `actions` and from the `EditorActions` type in `session.ts`. Leave the **read** helpers used by rendering (`effectiveTypography`, `defaultTypographyForKind`, `queueStyleDefinition` only if still used — grep first) intact.
- [ ] **Step 3: Companions** — update `runtime.ts.md`, `session.ts.md`. Byte-verify.
- [ ] **Step 4: `pnpm check` + `pnpm test`** — clean/green.

### Task 3.3: Commit 3

- [ ] **Step 1: Gates** — `pnpm check` + `pnpm test` green; companions byte-verify.
- [ ] **Step 2: Change record** `docs/records/2026-07-25-a2-layout-cleanup.md` (note: real-font defaults filed as `typography-defaults.md` / G6).
- [ ] **Step 3: Commit** to `main`:

```bash
git add src/lib/features/stages/document docs/records
git commit -m "A2 (3/3): Layout cleanup — remove semantic typography controls" \
  -m "Removes the rejected Goal-2.1 body/heading semantic-typography selects (Page + Margins remain) and the now-unused semantic write actions. The internal registry stays for rendering; real-font defaults are deferred to typography-defaults.md (G6)." \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push** all three commits: `git push origin main`.

---

## Appendix A — Companion byte-verification

For a changed file `X`, confirm its `X.md` reproduces it: extract every fenced code block from `X.md`, concatenate in order, and diff against `X` after normalizing (strip blank lines). A quick check:

```bash
node -e '
const fs=require("fs");
const [src,md]=process.argv.slice(1);
const code=fs.readFileSync(md,"utf8").match(/```[a-z]*\n([\s\S]*?)```/g)
  .map(b=>b.replace(/```[a-z]*\n/,"").replace(/```$/,"")).join("");
const norm=s=>s.split("\n").filter(l=>l.trim()!=="").join("\n").trim();
console.log(norm(code)===norm(fs.readFileSync(src,"utf8"))?"OK":"DRIFT");
' path/to/X path/to/X.md
```

Companion prose is additive — only the fenced blocks must reproduce the source.

## Appendix B — Omega round-trip verification

With a fresh Omega build on `:8444` (`nix develop --command go build -o SP/omega-core ./core`, run with the verify config), create a document, then POST a changeset to `/documents/:id/changes` for each op and re-`GET` the document. Assert:

- `insert_block` divider → block persisted `kind:'divider'`, `atoms: []`.
- `insert_block` code (atoms, no marks) → `kind:'code'`, atoms preserved, no marks.
- `insert_block` callout → `kind:'callout'`, atoms preserved.
- `set_block` paragraph→heading_1 → `kind:'heading_1'`.

Use `node` for JSON assembly/parsing. Record the pass in the commit's change record. (These ops predate the verify binary; no rebuild needed. Engine-dependent behavior is N/A here — these are pure document ops.)
```
