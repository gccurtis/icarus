# Document capability — canonical model

## Root snapshot

The Document's canonical state is one snapshot. It has a content flow and the
global inputs needed to lay that flow out. It has no persisted pages, page
coordinates, or browser selection paths. Rows are canonical content layout:
they define the vertical flow and sibling Block width proportions.

```ts
interface DocumentHead {
  id: string;
  title: string;
  lifecycle: "active" | "archived" | "trashed";
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: "active" | "archived" | "trashed";
  pageLayout: DocumentPageLayout;
  styles: StyleRegistry;
  rows: DocumentRow[];
}

interface DocumentPageLayout {
  page: {
    widthTwips: number;
    heightTwips: number;
    orientation: "portrait" | "landscape";
  };
  margins: {
    topTwips: number;
    rightTwips: number;
    bottomTwips: number;
    leftTwips: number;
  };
  pageNumber: {
    start: number;
    format: "decimal" | "roman-lower" | "roman-upper";
  };
}

interface DocumentRow {
  id: string;
  blocks: DocumentBlock[]; // left-to-right order
  layout: RowLayout;
}

interface RowLayout {
  tracks: RowTrack[]; // one track for each Block, in the same order
}

interface RowTrack {
  blockId: string;
  widthUnits: number; // positive; relative to sibling tracks in this Row
}
```

The canonical order of `rows` is top-to-bottom. Each Row's `blocks` array is
left-to-right. A Row's tracks name those Blocks and define only their relative
width. Page width minus left/right margins determines the Row's available width;
each Block's share is its `widthUnits` divided by the sum of all sibling
`widthUnits`. Most Rows have one Block with a `widthUnits` value of `1`.

New Rows/Blocks are inserted after stable sibling IDs; moved Rows/Blocks retain
their IDs. Array indexes are transient positions and must never be stored in
external references.

`pageBreakBefore`, `keepWithNext`, and `keepTogether` are persisted Block style
properties. Text alignment and wrapping are also Block properties and apply
within the Block's assigned width. Document stores these values but does not
store page positions or fragments.

## Block model

Blocks are closed and typed. A block takes normal flow width; text alignment
affects content within a paragraph-like Block, not the position of the Block's
own frame.

```ts
interface BlockBase {
  id: string;
  styleId: string;
  presentation?: BlockPresentationOverride;
  provenance: ProvenanceLink[];
}

type DocumentBlock =
  | (BlockBase & { kind: "paragraph"; content: InlineContent })
  | (BlockBase & { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; content: InlineContent })
  | (BlockBase & { kind: "quote"; content: InlineContent })
  | (BlockBase & { kind: "code"; language?: string; content: InlineContent })
  | (BlockBase & { kind: "prompt"; content: InlineContent; prompt: PromptDefinition })
  | (BlockBase & { kind: "callout"; tone: CalloutTone; rows: DocumentRow[] })
  | (BlockBase & { kind: "list"; list: DocumentList })
  | (BlockBase & { kind: "table"; table: DocumentTable })
  | (BlockBase & { kind: "image"; image: ImageBlockData })
  | (BlockBase & { kind: "chart"; chart: ChartBlockData })
  | (BlockBase & { kind: "embed"; embed: SafeEmbedData })
  | (BlockBase & { kind: "divider" });

type CalloutTone = "info" | "success" | "warning" | "danger" | "neutral";

interface PromptDefinition {
  instruction: string;
  contexts?: DocumentContext[];
  persona?: PromptPersonaRef;
  refreshPolicy: "manual" | "automatic";
  definitionRevision: number;
  contentRevision: number;
  lastResolution?: PromptResolution;
}

interface DocumentContext {
  id: string;
  kind: string;
}

interface PromptPersonaRef {
  personaId: string;
  version: number;
}

interface PromptResolution {
  status: "ok" | "insufficient" | "contradiction";
  resolutionKind: "initial" | "refresh";
  instructionDigest: string;
  baselineContentDigest: string;
  scopeManifest: KnowledgeScopeManifest;
  grounding: PromptGroundingManifest;
  promptDigest: string;
  schemaDigest: string;
  resolvedAt: string;
}

interface KnowledgeScopeManifest {
  contextDigest?: string;
  scopeDigest: string;
  resolvedContexts: DocumentContext[];
  resolvedResources: DocumentContext[];
  resolvedAt: string;
}

interface PromptGroundingManifest {
  digest: string;
  regions: PromptGroundingRegion[];
  resolvedAt: string;
}

interface PromptGroundingRegion {
  id: string;
  text: string;
  origin: ProvenanceLink["origin"];
  locator: ProvenanceLink["locator"];
}

interface PromptTextPatch {
  atomId: string;
  start: number;
  end: number;
  text: string;
}

interface PromptEditableText {
  text: string;
  protectedItems: Array<{ atomId: string; token: string }>;
}

interface PromptSynthesisCandidate {
  status: PromptResolution["status"];
  candidateText: string;
}

interface ProvenanceLink {
  origin: { kind: string; id: string; version: string; digest?: string };
  locator?: { kind: "text-range" | "resource-target" | "record"; value: Record<string, unknown> };
  relation: "quoted" | "derived" | "computed" | "transcluded" | "imported";
  admittedAt: string;
}
```

`prompt.content` is the editable canonical text. Styling projects it into the
display text; there is no separate display-content field. A prompt stores an
instruction and an optional list of `DocumentContext` values. Initially these
are direct Resource identities such as `{ id: documentId, kind: "document" }`.
Document passes the list unchanged to Knowledge, which scopes retrieval and
returns the exact `KnowledgeScopeManifest` recorded in `lastResolution`.

The two-field `DocumentContext` is deliberately Document-owned for now. When a
shared Context library exists, this shape can move there without changing
persisted Prompt definitions. There is no `subkind`; distinctions that matter
for scoping belong in `kind`.

A refresh receives the current `content` as its editorial baseline, but treats
retrieved lattice regions as the only factual authority. It synthesizes a
candidate, then derives minimal text patches. The reasoning model is responsible
for deciding which changes are grounded; its explicit templates instruct it to
preserve the baseline's form and update only grounded facts. The prompt-refresh
design specifies that process.

For refresh, Document serializes editable text atoms into `PromptEditableText`.
Formula/reference atoms become protected tokens that must survive unchanged. The
candidate is diffed back through that serialization into atom-local
`PromptTextPatch` operations, so normal text-mark transforms still apply and a
refresh cannot replace an inline item's type or move it across text.

Callouts are the only block with a nested general Row list. They may not
contain another callout. Rows retain the same horizontal-layout rule inside a
callout without turning the Document into an arbitrary visual canvas.

### Lists

```ts
interface DocumentList {
  kind: "bulleted" | "numbered" | "checklist";
  start?: number;
  items: ListItem[];
}

interface ListItem {
  id: string;
  checked?: boolean;
  rows: DocumentRow[];
  children: ListItem[];
}
```

`start` is permitted only on a numbered list. `checked` is permitted only on a
checklist item. List-item body blocks may not be callouts; nested list
items are the deliberate way to represent nested lists.

### Tables

```ts
interface DocumentTable {
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[];
  merges: TableMerge[];
}

interface TableColumn {
  id: string;
  width?: { kind: "auto" } | { kind: "fixed"; twips: number };
}

interface TableRow {
  id: string;
  minHeightTwips?: number;
  header: boolean;
}

interface TableCell {
  id: string;
  rowId: string;
  columnId: string;
  rows: DocumentRow[];
  verticalAlign: "top" | "middle" | "bottom";
}

interface TableMerge {
  id: string;
  rootCellId: string;
  coveredCellIds: string[];
}
```

Every row/column pair has one cell. A merge selects a root cell and covered
cells, preserving all cell IDs and content. Merge rectangles cannot overlap.
Table rows and columns can be reordered, but no operation changes a row,
column, or cell ID. Nested tables are allowed one level deep; that cap and the
overall Block depth are validated.

### Leaves

```ts
interface MediaSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

interface ImageBlockData {
  source: MediaSnapshotRef;
  alt: string;
  decorative: boolean;
  crop?: { left: number; top: number; right: number; bottom: number };
  fit: "contain" | "cover" | "stretch";
}

interface ChartBlockData {
  source: "literal" | "analysis-result" | "structured-binding";
  specification: Record<string, unknown>;
  snapshotDigest?: string;
}

interface SafeEmbedData {
  provider: "resource" | "video" | "iframe";
  source: string;
  title: string;
  sandbox: "strict" | "media";
}
```

Embeds are allowlisted descriptors, not persisted arbitrary HTML. Images require
alt text unless `decorative` is explicitly true.

## Rich text

Paragraph, heading, quote, code, and Prompt Blocks own inline content. Inline
atoms are the stable targets for formulas, references, marks, and text styles.

```ts
interface InlineContent {
  atoms: InlineAtom[];
  marks: InlineMark[];
}

type InlineAtom =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "formula"; formula: FormulaItem }
  | { id: string; kind: "reference"; target: DocumentReferenceTarget; provenance: ProvenanceLink[] };

type DocumentReferenceTarget =
  | { kind: "source"; sourceVersionId: string }
  | { kind: "evidence"; evidenceId: string; revision?: number }
  | { kind: "resource-target"; resourceKind: "document" | "slides" | "spreadsheet"; resourceId: string; targetId?: string };

interface FormulaItem {
  languageVersion: "formula/v1";
  expression: string;
  state: "pending" | "current" | "stale" | "error";
  evaluation?: FormulaEvaluationSnapshot;
}

interface FormulaEvaluationSnapshot {
  inputManifest?: FormulaInputManifest; // absent only when parsing failed before resolution
  value?: FormulaWireValue;
  displayText: string;
  diagnostics: FormulaDiagnosticSummary[];
  evaluationDigest?: string;
  evaluatorVersion?: string;
  evaluatedAt: string;
}

interface FormulaInputManifest {
  digest: string;
  dependencies: FormulaDependency[];
}

interface FormulaDependency {
  kind: "structured-name" | "structured-cell" | "spreadsheet-cell" | "analysis-output";
  id: string;
  version: string;
}

type FormulaWireValue = import("#platform/formula").FormulaWireValue;

interface FormulaDiagnosticSummary {
  code: string;
  message: string;
  span?: { startByte: number; endByte: number };
}

interface TextPosition {
  atomId: string;
  offset: number; // UTF-16 code-unit offset
  affinity: "before" | "after";
}

interface BlockTextRange {
  blockId: string;
  start: TextPosition;
  end: TextPosition; // half-open; both positions are in this Block
}

type InlineMark =
  | {
  id: string;
  kind: "bold" | "italic" | "underline" | "strike" | "code" | "link";
  start: TextPosition;
  end: TextPosition; // half-open
  href?: string;
}
  | {
      id: string;
      kind: "document-style";
      styleId: string;
      start: TextPosition;
      end: TextPosition; // half-open
    };
```

Marks and text styles can cover ordinary text and any range of a Formula atom's
accepted `displayText`. A client that styles a selection across several atoms or
Blocks submits one normalized range per affected Block. Formula atoms remain
atomic for editing: `text.splice` cannot change their evaluated display text,
and `formula.set-expression` is the only user operation that changes their
expression. Reference atoms remain atomic and use their parent Block's style.

When `formula.apply-evaluation` replaces one display string with another, the
reducer transforms marks over that Formula atom using the same clipping and
boundary rules as a whole-text replacement. Formula owns the expression
language, Name Manager integration, name recognition, evaluation, and value
encoding. Document owns deterministic display-text formatting, the Formula
atom, its accepted evaluation snapshot, its range marks, and evaluation
admission.

Offsets follow browser/TypeScript UTF-16 semantics. A reducer rejects an offset
outside its text atom or Formula display text, or one that splits a surrogate
pair. It clips/deletes marks after text replacement and normalizes duplicate
adjacent marks. Link values must use an allowlisted URL scheme.

## Text-range comment anchors

Comments are attached to selected text, not to a visible Block. The editor
converts a browser selection into stable internal endpoints before it creates a
Collaboration thread.

```ts
interface DocumentTextPosition extends TextPosition {
  blockId: string;
}

type DocumentCommentAnchor = DocumentTextRangeAnchor | DocumentAnchor;

interface DocumentTextRangeAnchor {
  kind: "text-range";
  documentId: string;
  start: DocumentTextPosition;
  end: DocumentTextPosition;
  observedRevision: number;
  quote: string;
  quoteDigest: string;
}

interface DocumentAnchor {
  kind: "document";
  documentId: string;
  assignedAtRevision: number;
  reason: "selected-text-deleted" | "selected-text-split";
}

type TextRangeResolution =
  | { kind: "current" | "rebased"; anchor: DocumentTextRangeAnchor }
  | { kind: "document"; anchor: DocumentAnchor };
```

Comments are created on text ranges, never Blocks. The row/block hierarchy is
only how Document finds and transforms range endpoints. Start/end affinity is
chosen so text inserted within or at either boundary of the selected range joins
that range; insertion elsewhere leaves it unchanged.

If an edit deletes selected text or splits selected text into separate Blocks,
Document promotes the comment to `DocumentAnchor`. It never silently anchors a
comment to a Block. `validate-text-range` therefore returns a current/rebased
text range or a Document anchor; Collaboration renders the latter as a
Document-level thread.

## Styles

```ts
interface StyleRegistry {
  defaults: { defaultParagraphStyleId: string; defaultCodeStyleId?: string };
  styles: DocumentStyle[];
}

interface DocumentStyle {
  id: string;
  name: string;
  basedOn?: string;
  text?: TextStyleProperties;
  block?: BlockStyleProperties;
}

interface TextStyleProperties {
  font?: { family: string; sizeHalfPoints: number; weight?: number; italic?: boolean };
  color?: string;
  background?: string;
}

interface BlockStyleProperties {
  spacing?: { beforeTwips: number; afterTwips: number; line: number };
  indentation?: { leftTwips: number; rightTwips: number; firstLineTwips: number };
  alignment?: "left" | "center" | "right" | "justify";
  wrapping?: "wrap" | "no-wrap" | "break-word";
  keepWithNext?: boolean;
  keepTogether?: boolean;
  pageBreakBefore?: boolean;
}

type BlockPresentationOverride = Partial<BlockStyleProperties>;
```

Named styles may contain text properties, block properties, or both. A Block
references a style for its block-flow properties; a `document-style` mark
references a style for a specific text range. Range application uses only the
style's `text` properties. Style inheritance must be acyclic. A style may not
be removed while referenced unless the same operation supplies a replacement
style. The canonical model stores semantic values, never CSS selectors.

## Structural validation

The reducer validates the complete resulting snapshot:

- all IDs are stable, unique, and never reused;
- array order is valid and every nested Block has one parent;
- block types are permitted in their enclosing container;
- style references and inheritance are valid;
- list/checklist and table/merge constraints hold;
- links, embeds, media references, and accessibility fields are safe;
- inline positions and marks are valid;
- nesting, text, table, snapshot, and ChangeSet limits are within configuration.

The canonical representation is versioned JSON with deterministic key ordering
and a SHA-256 semantic digest. This lets Bases and replay prove they
reconstruct the same Document.
