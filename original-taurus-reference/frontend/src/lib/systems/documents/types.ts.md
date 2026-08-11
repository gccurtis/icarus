# src/lib/systems/documents/types.ts — breakdown

Companion to [types.ts](types.ts). The document **shape contracts** — every TypeScript
type mirroring Omega's document JSON (core/capability/document), plus the module-level
default constants and the `newUnitId` helper. These types are the shared vocabulary the
rest of the documents system speaks; nothing here has runtime behavior beyond the two
`const` defaults and the id generator.

The semantic-style-registry section now carries an L6 signpost: the token types
(`SemanticTypography` etc.) and `CustomTypography` are both current — tokens for
block-type styling, custom + inline marks for real fonts. See `styles.ts.md`.

## Module contract and the inline text model

### The byte-offset note, atoms, anchors, and inline marks

```ts
/**
 * Document shape contracts mirroring Omega's JSON exactly
 * (core/capability/document in taurus-omega). Mark anchors are UTF-8 **byte**
 * offsets into an atom's text — the editor bridge translates them to JS
 * character offsets (docs/architecture/document-editor.md).
 */
export type Atom = { id: string; kind: 'text'; text: string };
export type Anchor = { atomId: string; offset: number };
export type MarkKind =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link'
  | 'font' | 'fg' | 'bg';
export type DocMark = {
  id: string;
  kind: MarkKind;
  attrs?: Record<string, string>;
  start: Anchor;
  end: Anchor;
};
```

The module doc-comment pins the central contract: these types mirror Omega's JSON
byte-for-byte, and mark anchors are **byte** offsets (the editor bridge converts them to
JS character offsets, per the linked discrepancy). An `Atom` is the smallest run of text;
an `Anchor` points at a byte offset within one atom. A `DocMark` is an inline formatting
span — a `MarkKind` (basic styling plus `font`/`fg`/`bg`), optional `attrs`, and a
`start`/`end` anchor pair delimiting the run it covers.

## Block kinds

### The block-kind union and a text block's semantic sub-kind

```ts
/** Omega's block kinds (core/capability/document model.go). A `text` block carries
 *  a semantic `subKind`; every other kind stands alone. */
export type BlockKind = 'text' | 'code' | 'callout' | 'list' | 'divider' | 'image' | 'prompt';
/** A text block's semantic role: a built-in (`body`, `heading_1..6`) or the id of a
 *  custom style definition applying to `text`. */
export type TextSubKind =
  | 'body' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6';
```

`BlockKind` enumerates the seven block kinds Omega recognizes. Only a `text` block carries
a `TextSubKind` — its semantic role, either a built-in (`body` or `heading_1..6`) or the id
of a custom style definition that applies to `text`; every other kind stands alone.

## Prompt blocks

### Evidence spans and a prompt block's resolution data

```ts
export type PromptEvidence = {
  sourceType: string;
  sourceId: string;
  start: number;
  end: number;
  text: string;
  relevance: number;
};
export type PromptData = {
  instruction?: string;
  status?: 'ok' | 'insufficient' | 'contradiction';
  evidence?: PromptEvidence[];
  lastInstruction?: string;
  lastOutput?: string;
  resolvedAt?: string;
};
```

`PromptEvidence` is one supporting span a resolved prompt drew on — its source, character
range, snippet, and a `relevance` score. `PromptData` is a prompt block's state: the
current `instruction`, a resolution `status`, the `evidence` behind the last answer, and
the last instruction/output plus a timestamp for showing what the block last produced.

## Alignment, page, and layout geometry

### Alignment enums, the page box, layout rules, and row style

```ts
export type HorizontalAlignment = 'left' | 'center' | 'right';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';
export type PageLayout = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};
export type LayoutRules = {
  maxFontHeight: number;
  minRowPadding: number;
  maxHeightIncrease: number;
};
export type RowStyle = { heightIncrease: number };
```

The two alignment enums drive block placement. `PageLayout` is the printable page box —
size and the four margins, all in points. `LayoutRules` are the constraints the layout
engine enforces (max font height, minimum row padding, max height increase). `RowStyle`
carries a row's single tunable, its extra `heightIncrease` above the natural content
height.

## Column tracks and block style

### A row's column tracks and a block's alignment/indent style

```ts
/** One column's horizontal layout within a row — mirrors Omega's `Track`. The
 *  row's content width is divided among its blocks in proportion to their
 *  `weight`; `gap` is trailing space to the next column, `minWidth` a floor
 *  (both in points). Omitted/empty tracks mean equal-width columns. */
export type Track = { blockId: string; weight: number; gap?: number; minWidth?: number };
export type BlockStyle = {
  horizontalAlign: HorizontalAlignment;
  verticalAlign: VerticalAlignment;
  /** General block indent level (0 = flush left), bounded 0–16 in Omega. */
  indent?: number;
};

```

A `Track` describes one column within a row: the row's content width is split among blocks
in proportion to their `weight`, with an optional `gap` to the next column and a `minWidth`
floor (both points); omitting tracks means equal-width columns. `BlockStyle` is a block's
placement — horizontal and vertical alignment plus an optional `indent` level (0 = flush
left, bounded 0–16 in Omega).

## Semantic style registry — facet enums

### The registry preamble and every semantic facet enum

```ts
// --- Semantic style registry (mirrors Omega core/capability/document/style.go) ---
// Styles are semantic *tokens*, never raw fonts/sizes/colors. A document carries a
// registry of named StyleDefinitions + per-block-kind defaults; each block may
// reference one style and override individual facets (within what the definition
// permits).
export type SemanticTypography =
  | 'body' | 'body_small' | 'label' | 'title' | 'heading' | 'display' | 'code' | 'quote';
export type SemanticSpacing = 'none' | 'tight' | 'compact' | 'normal' | 'relaxed' | 'spacious';
export type SemanticPadding = 'none' | 'compact' | 'normal' | 'roomy';
export type SemanticBorder = 'none' | 'subtle' | 'strong' | 'accent';
export type SemanticBackground = 'none' | 'subtle' | 'muted' | 'emphasis' | 'inverse';
export type SemanticTone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical';
export type StyleOverrideKey =
  | 'typography' | 'spacing' | 'padding' | 'border' | 'background' | 'tone';

```

The comment block states the registry's premise: styles are semantic *tokens*, never raw
fonts/sizes/colors. Each enum names the allowed values of one facet — typography, spacing,
padding, border, background, and tone — and `StyleOverrideKey` names those same six facets
as the keys a block is permitted to override.

## Style definitions, payloads, and the registry

### Named styles, per-kind defaults, custom typography, image/list payloads, overrides, and the registry

```ts
/** A named, reusable semantic style. `appliesTo` lists the block kinds it may style. */
export type StyleDefinition = {
  id: string;
  name: string;
  appliesTo: string[];
  typography: SemanticTypography;
  spacing: SemanticSpacing;
  padding: SemanticPadding;
  border: SemanticBorder;
  background: SemanticBackground;
  tone: SemanticTone;
  allowOverrides?: StyleOverrideKey[];
};
/** The document default style for one block kind. */
export type StyleDefault = { blockKind: string; styleId: string };
/** Free-form (non-semantic) typography — the block-override level of Omega's
 *  cascade. Stored verbatim on a block; `fontSize` is any CSS unit ("14px"), `fg`
 *  the foreground and `bg` the background (safe CSS colors). Per block; set via
 *  `set_block_custom_typography`. Font/fg/bg are also settable inline as marks. */
export type CustomTypography = { fontFamily?: string; fontSize?: string; fg?: string; bg?: string };
/** An image block's payload (mirrors Omega ImageData). Added for model
 *  completeness; image insert/render is deferred to its own pass. */
export type ImageData = { fileId: string; alt: string; width: number; height: number };
/** A list block's marker style (mirrors Omega ListType). */
export type ListType = 'bullet' | 'ordered' | 'check';
/** One list item — inline content exactly like a text block, plus a nesting
 *  `level` and (for check lists) a `checked` state. */
export type ListItem = { level: number; checked?: boolean; atoms: Atom[]; marks?: DocMark[] };
/** A list block's payload (mirrors Omega ListBlockData): its marker type, the
 *  ordered-list start ordinal, and the ordered items. */
export type ListBlockData = { type: ListType; start?: number; items: ListItem[] };
/** Per-facet overrides applied on top of a block's referenced style. */
export type StyleOverrides = {
  typography?: SemanticTypography;
  spacing?: SemanticSpacing;
  padding?: SemanticPadding;
  border?: SemanticBorder;
  background?: SemanticBackground;
  tone?: SemanticTone;
  /** Free-form real-font override (ungated by the style definition's allowOverrides). */
  custom?: CustomTypography;
};
/** A block's reference to a registry style, plus any allowed facet overrides. */
export type BlockStyleRef = { styleId: string; overrides?: StyleOverrides };
/** The document's style registry: named definitions + per-kind defaults. */
export type StyleRegistry = { definitions?: StyleDefinition[]; defaults?: StyleDefault[] };

```

`StyleDefinition` is a named, reusable style fixing all six facets and listing which block
kinds it `appliesTo` and which facets it `allowOverrides`. `StyleDefault` binds one block
kind to its default style id. `CustomTypography` is the free-form, non-semantic override
level of the cascade — real font family, size, and colors, stored verbatim on a block (and
also settable inline as marks). `ImageData` and the list trio (`ListType`, `ListItem`,
`ListBlockData`) are block payloads mirroring Omega's shapes. `StyleOverrides` are the
per-facet tweaks laid on top of a referenced style (plus a `custom` real-font escape
hatch); `BlockStyleRef` pairs a `styleId` with those overrides; and `StyleRegistry` holds
the document's definitions and per-kind defaults.

## Blocks and rows

### A block and a row

```ts
export type Block = {
  id: string;
  kind: BlockKind;
  /** For `text` blocks only: the semantic sub-kind (`body`, `heading_1..6`, or a
   *  custom style id). Absent/empty for every other kind. */
  subKind?: string;
  style: BlockStyle;
  styleRef?: BlockStyleRef | null;
  inferred?: boolean;
  atoms: Atom[];
  marks?: DocMark[];
  data?: unknown;
};
export type Row = { id: string; style: RowStyle; tracks?: Track[]; blocks: Block[] };

```

A `Block` is the core content unit: its `kind`, an optional text-only `subKind`, its
placement `style` and optional `styleRef`, an `inferred` flag, its `atoms` and inline
`marks`, and a kind-specific `data` payload (image/list). A `Row` holds an ordered list of
blocks with an optional set of column `tracks`. (`RowManifestEntry` was deleted with the
pagination row-repository in workstream B — nothing consumed it.)

## Document templates

### A template's context variables and the picker's template shape

```ts
/** One context variable a template declares (Omega `ContextVariable`) — a named
 *  free-text slot bound when the template is instantiated. */
export type TemplateVariable = { name: string; description?: string };
/** A document template for the New-tab carousel: an Omega document whose
 *  `base.template.isTemplate` is set, reduced to what the picker needs. */
export type DocumentTemplate = { id: string; name: string; variables: TemplateVariable[] };

```

`TemplateVariable` is one named, free-text slot a template declares (Omega's
`ContextVariable`), bound when the template is instantiated. `DocumentTemplate` is the
reduced view the New-tab template carousel needs — a template document's id and name plus
its declared variables — projected from an Omega document whose `base.template.isTemplate`
flag is set. The documents API client (`api.ts` → `listTemplates`) maps full template
documents down to this shape.

## The document aggregate

### The top-level `Doc` shape

```ts
export type Doc = {
  id: string;
  projectId: string;
  name: string;
  base: {
    pageLayout: PageLayout;
    layoutRules: LayoutRules;
    styleRegistry: StyleRegistry;
    /** Document-wide default free-form typography — the lowest typography cascade level. */
    defaultTypography?: CustomTypography | null;
    rows: Row[];
  };
  creatorId: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  clientCapabilities: {
    canonicalLayout: boolean;
    revisionSubmissions: boolean;
  };
};

```

`Doc` is the top-level document. `base` holds the renderable content — page layout, layout
rules, the style registry, the document-wide `defaultTypography` (the lowest level of the
typography cascade), and the ordered `rows`. Outside `base` are the identity/creator/
timestamp fields, the monotonic `revision`, and `clientCapabilities`, which records which
protocol features this client supports (canonical layout and revision-aware submissions);
`api.ts`'s `normalizeDocument` fills these in.

## Runtime defaults

### Default page layout, layout rules, and the empty style registry

```ts
export const defaultPageLayout: PageLayout = {
  width: 612, height: 792,
  marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72
};

export const defaultLayoutRules: LayoutRules = {
  maxFontHeight: 24, minRowPadding: 4, maxHeightIncrease: 144
};

/** An empty style registry — the shape Omega returns for a document with no styles. */
export const emptyStyleRegistry: StyleRegistry = { definitions: [], defaults: [] };

```

The two `const` defaults are US-Letter page geometry (612×792 pt, one-inch margins) and
conservative layout rules; `normalizeDocument` merges incoming documents over them so every
`Doc` is shape-stable. `emptyStyleRegistry` is the canonical empty registry — the shape
Omega returns for a document with no styles.

## Change operations

### The change-op union and a committed change set

```ts
export type ChangeOp = {
  op:
    | 'insert_row' | 'delete_row' | 'insert_block' | 'delete_block'
    | 'set_block' | 'set_block_subkind' | 'set_block_indent'
    | 'insert_atom' | 'delete_atom' | 'set_atom_text'
    | 'add_mark' | 'update_mark' | 'remove_mark' | 'set_prompt' | 'resolve_block'
    | 'set_page_layout' | 'set_block_line_height' | 'set_block_alignment'
    | 'set_row_tracks'
    | 'set_block_data' | 'set_list_type' | 'set_list_item'
    | 'put_style_definition' | 'set_style_default' | 'assign_block_style'
    | 'set_block_style_overrides' | 'set_block_custom_typography' | 'set_default_typography';
  afterRow?: string; rowId?: string; afterBlock?: string;
  blockId?: string; afterAtom?: string; atomId?: string; markId?: string;
  row?: Row; block?: Block; atom?: Atom; mark?: DocMark;
  pageLayout?: PageLayout; setKind?: string; setSubKind?: string; setText?: string;
  indent?: number;
  lineHeight?: number; horizontalAlign?: HorizontalAlignment;
  verticalAlign?: VerticalAlignment; tracks?: Track[];
  // List editing.
  listData?: ListBlockData; setListType?: ListType; listStart?: number;
  listIndex?: number; item?: ListItem | null;
  // Semantic style ops.
  style?: StyleDefinition; styleRef?: BlockStyleRef | null;
  styleOverrides?: StyleOverrides; styleId?: string; defaultBlockKind?: string;
  // Free-form real-font override (block level) + document default.
  customTypography?: CustomTypography | null;
};
export type ChangeSet = {
  id: string; documentId: string; authorId: string; authorName: string;
  submissionId?: string; priorRevision: number; seq: number;
  createdAt: string; ops: ChangeOp[]; undoOf?: string; redoOf?: string;
};

```

`ChangeOp` is the discriminated edit operation — the `op` union names every mutation
(structure, text, marks, prompts, layout, lists, and semantic/custom style), and the
optional fields below carry whichever payload that op needs (row/block/atom targets and
insert positions, layout values, list edits, style refs, and free-form typography). A
`ChangeSet` is a committed batch: its id, document and author, an optional idempotency
`submissionId`, the `priorRevision`/`seq` for ordering, the `ops`, and `undoOf`/`redoOf`
back-references when it inverts an earlier set.

## Input and job shapes

### The create-row input and a job's status

```ts
export type NewRow = { blocks: { kind: BlockKind; atoms: { kind: 'text'; text: string }[] }[] };
export type Job = { status: 'queued' | 'running' | 'done' | 'failed' | string; error?: string };

```

`NewRow` is the minimal row shape `createDocument` accepts — just block kinds and their
text atoms, before the server assigns ids and defaults. `Job` is the poll shape for an
async task (prompt resolution, generation): a `status` string and an optional `error`.

## Unit id generator

### Mint a dash-free UUID for new units

```ts
export function newUnitId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
```

`newUnitId` mints a fresh identifier for a new atom, block, or row by stripping the dashes
from a random UUID — the compact id format Omega expects. It is re-exported from `api.ts`
so callers get it alongside the rest of the documents surface.
