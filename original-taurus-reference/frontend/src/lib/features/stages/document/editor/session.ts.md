# src/lib/features/stages/document/editor/session.ts — breakdown

Companion to [session.ts](session.ts). The editor-session store: the typed
contract between the document stage and the shell's context/inspector panels. It
declares the selection vocabulary, the block/typography descriptions, the full
set of actions the inspector may invoke, the whole session shape, and the
`editorSession` store itself.

## Imports

### Svelte's `writable` and the document domain types

```ts
import { writable } from 'svelte/store';
import type {
  BlockKind,
  CustomTypography,
  HorizontalAlignment,
  LayoutRules,
  MarkKind,
  PageLayout,
  PromptData,
  SemanticTypography,
  StyleRegistry,
  VerticalAlignment
} from '$data/documents';

```

`writable` backs the exported store; the single type-only import pulls in the document domain
vocabulary from `$data/documents`. The old `$data/document-layout` and `PagePlan` imports left
with pagination (workstream B): the session no longer carries page plans, windowing hints, or
the UI page-geometry vocabulary.

## The editor-session contract

### Module doc-comment: the store is the whole stage/panel seam

```ts
/**
 * The editor session — the seam between the document stage and the shell panels.
 *
 * The DocumentStage publishes this store (doc metadata, live selection, and the
 * actions the inspector may invoke); the context/inspector panel contents read
 * it. The panels never touch ProseMirror and the stage never touches the panels
 * — this store is the whole contract. `null` means no document editor is active
 * (the panels show their intentional defaults).
 */

```

The overview states the architectural rule this file encodes: the stage owns
ProseMirror and publishes a plain data view; the panels only read that view and
call back through `actions`. Because the store is the entire contract, `null`
cleanly represents "no editor active," letting panels fall back to their defaults.

## Outline and search types

### The outline entry, search options, and one search result

```ts
/** One outline entry — a heading block, in document order. */
export type OutlineItem = { blockId: string; level: number; text: string };

/** User-facing search controls kept independent of ProseMirror. */
export type SearchOptions = { matchCase: boolean; wholeWord: boolean; useRegex: boolean };

/** One text match in document order, carrying editor positions for navigation. */
export type SearchResult = {
  id: string;
  blockId: string | null;
  block: number;
  kind: BlockKind;
  from: number;
  to: number;
  match: string;
  preview: string;
};

```

`OutlineItem` is a flattened heading used to render the document outline.
`SearchOptions` holds the three user-facing toggles, deliberately independent of
ProseMirror so the panel can own them. `SearchResult` describes one match in
document order and carries the editor `from`/`to` positions the stage needs to
focus or replace it.

## Inline-format state and the block description

### The typography state and the ProseMirror-free block shape

```ts
/** Inline-format state shared by selected text and the next typed character. */
export type TypographyState = {
  /** Which real Omega mark kinds are present anywhere in the target. */
  marks: Record<MarkKind, boolean>;
  /** The first link href in the target (`''` when none). */
  linkHref: string;
  /** Active inline font family / size (from the `font` mark), `''` when unset. */
  fontFamily: string;
  fontSize: string;
  /** Active inline foreground / background color (from the `fg` / `bg` marks). */
  fg: string;
  bg: string;
};

/** One top-level editor block, described without exposing ProseMirror types. */
export type InspectedBlock = {
  blockId: string | null;
  rowId: string | null;
  pos: number;
  kind: BlockKind;
  /** For a text block: its sub-kind (`body`, `heading_1..6`, or a custom id). */
  subKind?: string;
  /** For a list block: its marker type + ordered start. */
  listType?: string;
  listStart?: number;
  text: string;
  empty: boolean;
};

```

`TypographyState` captures the inline formatting that applies both to a current
selection and to the next-typed character — which marks are active, the link href,
and the real font family/size and fg/bg colors. `InspectedBlock` describes one
top-level block in the inspector's own vocabulary (kind, sub-kind, list marker,
position, text) so panels never see raw ProseMirror nodes.

## The selection union

### Every mode the inspector understands, some intersected with `TypographyState`

```ts
/**
 * What is currently selected in the editor, in the inspector's vocabulary:
 * - `none`      — the editor isn't focused on anything inspectable.
 * - `run`       — selected text, possibly crossing block boundaries.
 * - `new-text`  — the insertion point and formatting for what is typed next.
 * - `block`     — one existing block.
 * - `blocks`    — an explicit multi-block selection.
 * - `row`       — a horizontal group and its child blocks.
 * - `new-block` — an empty paragraph ready to be assigned a kind.
 */
export type SelectionInfo =
  | { mode: 'none' }
  | ({
      mode: 'run';
      blockIds: string[];
      /** The distinct rows the selection touches, in document order — the target for
       *  row-scoped controls (line spacing). Every other lens can derive its rows from
       *  its `InspectedBlock`s; a run carries only block ids, so the runtime names them
       *  here. `setRowHeight` resolves these against the snapshot by row id. */
      rowIds: string[];
      text: string;
      chars: number;
      words: number;
      /** The start block's text-type subKind when it is a text block, for the
       *  inspector's Text type control. A range can span blocks, so it reflects the
       *  first block and `setTextType` applies across the whole selection. */
      subKind?: string;
    } & TypographyState)
  | ({ mode: 'new-text'; block: InspectedBlock; caret: number } & TypographyState)
  | { mode: 'block'; block: InspectedBlock }
  | ({ mode: 'new-block'; block: InspectedBlock } & TypographyState)
  | {
      mode: 'blocks';
      items: InspectedBlock[];
    }
  | {
      mode: 'row';
      rowId: string;
      items: InspectedBlock[];
    };

```

`SelectionInfo` is the discriminated union the inspector switches on. The
text-bearing modes (`run`, `new-text`, `new-block`) intersect `TypographyState`
so the format controls have live state, while `block`/`blocks`/`row` carry one or
more `InspectedBlock`s. `none` is the inspectable-nothing case.

`run` is the one mode that names its rows explicitly (`rowIds`). The others hand the
inspector `InspectedBlock`s, each carrying its own `rowId`, so a row-scoped control can
derive its target; a run reports only the block ids it spans, which left line spacing with
no row to write to. Rather than have the panel guess, the runtime collects the touched rows
during the same document walk that collects the block ids.

## Actions the inspector can invoke

### The stage-implemented callback surface, one method per inspector operation

```ts
/** Actions the inspector can invoke on the live editor (stage-implemented). */
export type EditorActions = {
  /** Rename the canonical Resource and its open workspace tab. */
  renameDocument(name: string): Promise<void>;
  /** Find every in-block text match using the current editor truth. */
  searchText(query: string, options: SearchOptions): SearchResult[];
  /** Focus and select one search result in the editor. */
  focusSearchResult(result: SearchResult): void;
  /** Replace one or more current search matches as a single editor transaction. */
  replaceSearchResults(results: SearchResult[], replacement: string): number;
  /** Inspect one row child as a block and focus it in the editor. */
  inspectBlock(blockId: string): void;
  /** Change the inspected block's kind (paragraph, heading_N, prompt). */
  setBlockKind(kind: BlockKind): void;
  /** Convert every text block the current selection touches to a text sub-kind
   *  (Body / Heading 1-6). Whole-line: one set_block_subkind per touched block. */
  setTextType(subKind: string): void;
  /** Insert a new element block (divider / code / callout / list / prompt) at the
   *  current line — replaces an empty line, else inserts after it. */
  insertElement(kind: BlockKind): void;
  /** Set the inspected list block's marker type (bullet / ordered / check) and,
   *  for ordered lists, its start ordinal. */
  setListType(listType: string, start?: number): void;
  /** Update the local height model for one or more document rows. */
  setRowHeight(rowKeys: string[], heightPx: number): void;
  /** Toggle a real inline mark over selected text or at the insertion point. */
  toggleMark(kind: MarkKind): void;
  /** Apply or clear an inline typography mark (`font` merges family/size; `fg`/`bg`
   *  carry a CSS color) over the selection, or store it for the next-typed text.
   *  Pass null (or a blank value) to clear. */
  setInlineStyle(kind: 'font' | 'fg' | 'bg', attrs: Record<string, string> | null): void;
  /** Set the general indent level (0–16) on the inspected block(s) — set_block_indent. */
  setBlockIndent(blockIds: string[], indent: number): void;
  /** Apply a link over selected text or at the insertion point (null removes it). */
  setLink(href: string | null): void;
  /** Wrap the current text selection in quotation marks (a plain text edit). */
  quoteSelection(): void;
  /** Set alignment on the inspected block(s) — maps to Omega's set_block_alignment. */
  setBlockAlignment(
    blockIds: string[],
    patch: { horizontalAlign?: HorizontalAlignment; verticalAlign?: VerticalAlignment }
  ): void;
  /** Insert a new empty block as a column beside the given block, in its row. */
  addColumn(afterBlockId: string, side: 'left' | 'right'): void;
  /** Set the document default style for a block kind to a semantic typography token
   *  (LayoutPanel) — seeds the style definition + set_style_default. */
  setBlockKindTypography(kind: BlockKind, typography: SemanticTypography): void;
  /** Assign a semantic typography token to the given block(s) (Details panel) —
   *  seeds the style definition + assign_block_style. */
  setBlockTypography(blockIds: string[], typography: SemanticTypography): void;
  /** Set real font family/size/color on the given block(s) — merges the patch over
   *  current custom typography and emits set_block_custom_typography. */
  setBlockCustomTypography(blockIds: string[], patch: Partial<CustomTypography>): void;
  /** Set the document-wide default typography (Base level) — merges the patch and
   *  emits set_default_typography (a blank value clears the field). */
  setDefaultTypography(patch: Partial<CustomTypography>): void;
  /** Save the current prompt block's instruction (appended as a set_prompt op). */
  setPrompt(instruction: string): void;
  /** Resolve the current prompt block (async job; reloads the document when done). */
  resolvePrompt(mode?: '' | 'reload' | 'refresh'): void;
  /** Move the cursor to a heading (outline click) and scroll it into view. */
  focusHeading(blockId: string): void;
};

```

`EditorActions` is the callback surface the stage implements and the inspector
calls — the only way panels affect the document. Each method's doc-comment names
the Omega op it ultimately emits (`set_block_subkind`, `set_block_indent`,
`assign_block_style`, `set_prompt`, and so on), keeping the mapping from UI
gesture to change-set operation visible at the contract. `setPageLayout` was
removed with pagination — Alpha no longer edits page geometry anywhere.

## The session shape

### All the data the panels read: metadata, layout, style cascade, counts, selection

```ts
export type EditorSession = {
  docId: string;
  name: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  rows: number;
  rowHeights: Record<string, number>;
  /** Per-block style — alignment + indent (server truth + optimistic pending), keyed by block id. */
  blockAligns: Record<string, { horizontalAlign: HorizontalAlignment; verticalAlign: VerticalAlignment; indent?: number }>;
  /** Whether layout ops (page geometry, alignment, line height) persist to Omega —
   *  when false, those controls change only local state, so the UI must say so. */
  supportsCanonicalLayout: boolean;
  /** The document's semantic style registry (definitions + per-kind defaults). */
  styleRegistry: StyleRegistry;
  /** Each block's effective semantic typography (override → style → kind default),
   *  keyed by block id — the current value the inspector's typography control shows. */
  blockTypographies: Record<string, SemanticTypography>;
  /** Each block's effective custom typography (real font/size/color), keyed by block id. */
  blockCustomTypography: Record<string, CustomTypography>;
  /** The document-wide default typography (lowest cascade level). */
  defaultTypography: CustomTypography;
  /** The document's canonical page geometry — read-only server truth. The stage
   *  renders it as the continuous paper's width and margins; nothing paginates
   *  against it and nothing in Alpha edits it. */
  canonicalPageLayout: PageLayout;
  layoutRules: LayoutRules;
  blocks: number;
  words: number;
  chars: number;
  outline: OutlineItem[];
  selection: SelectionInfo;
  /** Each prompt block's resolved data (instruction, status, evidence, last output),
   *  keyed by block id — what the inspector's prompt section renders. */
  blockPrompts: Record<string, PromptData>;
  /** True while a prompt-block resolve job is running. */
  resolving: boolean;
  actions: EditorActions;
};

```

`EditorSession` is the whole published view. It carries document metadata and
creator attribution, the row-height and per-block alignment/indent models, the
`supportsCanonicalLayout` gate (so the UI can warn when layout edits stay local),
the layered typography cascade (per-block custom over per-block semantic over the
registry's per-kind defaults, all above a document-wide default), the read-only
canonical page layout and layout rules, the live word/char/block counts, the
outline, the current `selection`, per-block prompt data with a `resolving` flag,
and finally the `actions` surface. The pagination-era fields — `pages`, `pagePlan`,
`requestedRowWindow`, and the print-string `pageLayout` — were removed in
workstream B along with the machinery that produced them.

## The session store

### The single exported store, `null` when no editor is active

```ts
/** The active document editor's session; null when no document stage is active. */
export const editorSession = writable<EditorSession | null>(null);
```

`editorSession` is the module's single export instance: a writable store the
DocumentStage sets while mounted and clears (`null`) when it unmounts, and which
the panels subscribe to.
