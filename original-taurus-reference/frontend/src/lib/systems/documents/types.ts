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
/** Omega's block kinds (core/capability/document model.go). A `text` block carries
 *  a semantic `subKind`; every other kind stands alone. */
export type BlockKind = 'text' | 'code' | 'callout' | 'list' | 'divider' | 'image' | 'prompt';
/** A text block's semantic role: a built-in (`body`, `heading_1..6`) or the id of a
 *  custom style definition applying to `text`. */
export type TextSubKind =
  | 'body' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6';
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

// --- Semantic style registry (mirrors Omega core/capability/document/style.go) ---
// Styles are semantic *tokens*, never raw fonts/sizes/colors. A document carries a
// registry of named StyleDefinitions + per-block-kind defaults; each block may
// reference one style and override individual facets (within what the definition
// permits).
//
// SIGNPOST (catalog L6): this token system and `CustomTypography` below are BOTH
// current — tokens back block-TYPE styling ("Text type" in the inspector),
// CustomTypography + inline font/fg/bg marks back real-font styling, the shipped
// direction for user-facing font choices. See styles.ts for the full note.
export type SemanticTypography =
  | 'body' | 'body_small' | 'label' | 'title' | 'heading' | 'display' | 'code' | 'quote';
export type SemanticSpacing = 'none' | 'tight' | 'compact' | 'normal' | 'relaxed' | 'spacious';
export type SemanticPadding = 'none' | 'compact' | 'normal' | 'roomy';
export type SemanticBorder = 'none' | 'subtle' | 'strong' | 'accent';
export type SemanticBackground = 'none' | 'subtle' | 'muted' | 'emphasis' | 'inverse';
export type SemanticTone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical';
export type StyleOverrideKey =
  | 'typography' | 'spacing' | 'padding' | 'border' | 'background' | 'tone';

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

/** One context variable a template declares (Omega `ContextVariable`) — a named
 *  free-text slot bound when the template is instantiated. */
export type TemplateVariable = { name: string; description?: string };
/** A document template for the New-tab carousel: an Omega document whose
 *  `base.template.isTemplate` is set, reduced to what the picker needs. */
export type DocumentTemplate = { id: string; name: string; variables: TemplateVariable[] };

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

export const defaultPageLayout: PageLayout = {
  width: 612, height: 792,
  marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72
};

export const defaultLayoutRules: LayoutRules = {
  maxFontHeight: 24, minRowPadding: 4, maxHeightIncrease: 144
};

/** An empty style registry — the shape Omega returns for a document with no styles. */
export const emptyStyleRegistry: StyleRegistry = { definitions: [], defaults: [] };

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

export type NewRow = { blocks: { kind: BlockKind; atoms: { kind: 'text'; text: string }[] }[] };
export type Job = { status: 'queued' | 'running' | 'done' | 'failed' | string; error?: string };

export function newUnitId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
