# Document capability — canonical model

## Root snapshot

The Document's canonical state is one `DocumentSnapshot`. It contains the
authored content flow, reusable styles, and the global page-layout inputs needed
for future layout projections. It contains no rendered pages, page fragments,
browser nodes, or pixel coordinates.

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
  styles: DocumentStyleRegistry;
  rows: DocumentRow[];
}
```

Document identity lives in `DocumentHead` and store keys. The snapshot is the
semantic value at one revision and therefore does not need to repeat the ID.

## Page layout

The page layout applies to the entire Document. There is no mid-document
geometry switch in representation version 1.

```ts
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
```

Validation requires positive page dimensions, non-negative margins, and usable
width and height after subtracting margins. Orientation is descriptive but must
agree with the supplied dimensions. Exact pagination is deferred; these fields
are canonical now because they affect eventual line wrapping and export.

## Reusable styles

A Document Style is a named reusable bundle. Style IDs, not names, are stable.
Names may be changed freely, and no behavior depends on a style being named
`Heading 1`, `Normal`, or any other reserved string.

```ts
type TextStyleProperties = import("#rich-text").TextStyleProperties;

interface DocumentStyleRegistry {
  defaultStyleIdByBlockKind: Record<DocumentBlock["kind"], string>;
  styles: DocumentStyle[];
}

interface DocumentStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  text: TextStyleProperties;
  block: BlockStyleProperties;
  /** Protected semantic role. Visual properties and display name remain
   * editable, but the role itself cannot be removed or reassigned. */
  systemRole?: DocumentSystemStyleRole;
}

type DocumentSystemStyleRole =
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6";

interface BlockStyleProperties {
  alignment?: "left" | "center" | "right" | "justify";
  wrapping?: "wrap" | "no-wrap" | "break-word";
  spacingBeforeTwips?: number;
  spacingAfterTwips?: number;
  lineHeight?: number;
  indentation?: {
    leftTwips: number;
    rightTwips: number;
    firstLineTwips: number;
  };
  keepWithNext?: boolean;
  keepTogether?: boolean;
}

interface BlockPresentationOverride {
  alignment?: BlockStyleProperties["alignment"];
  wrapping?: BlockStyleProperties["wrapping"];
  spacingBeforeTwips?: number;
  spacingAfterTwips?: number;
  lineHeight?: number;
  indentation?: BlockStyleProperties["indentation"];
  keepWithNext?: boolean;
  keepTogether?: boolean;
}
```

Style inheritance is acyclic. Resolution begins with the oldest ancestor and
overlays each child style by property. Every `styleId` and `basedOnStyleId`
must resolve inside the same snapshot.

Every heading role appears exactly once. A protected heading Style may be
renamed and all of its visual and Block properties may be changed, but it
cannot be deleted and its `systemRole` cannot be changed. The outline derives
its level from these six roles. It does not inspect a style's name and does not
use a free-form outline-level property. Normal, Quote, Code, and other reusable
Styles remain ordinary Styles; kind defaults reference them by stable ID and
can be repointed through normal Style operations.

### Overlay order

For one text-bearing Block:

1. Rich Text configuration supplies global fallback values.
2. Document resolves the default style for the Block kind.
3. Document resolves the Block's selected `styleId`, including its inheritance
   chain, and overlays it over the kind default. If both IDs are equal, it is
   resolved only once.
4. The Block's optional one-off presentation override overlays the resolved
   Block presentation values.
5. Document creates an ephemeral full-range Rich Text style mark from the
   resolved style's text properties.
6. Rich Text overlays that authoritative Block mark with the Block's stored
   inline marks as supplementary marks.

The ephemeral full-range mark is a rendering projection and is never written
back into `RichContent`.

Applying a saved style to only a selected range is a shortcut: the current
resolved text properties are copied into one ordinary Rich Text `style` mark.
That inline mark becomes exact authored formatting. Later edits to the saved
style update Blocks that reference it, but do not rewrite historical inline
marks.

Rich Text `LinkMark` is unrelated to saved-style reuse. A Link Mark stores
navigation targets such as a URL or resource and happens to address a text
range; it is not a generic reference to another mark or to a Document Style.
The existing Rich Text `StyleMark` stores concrete `TextStyleProperties`, not a
`styleId`. A live-linked range style would therefore require a new Rich Text
mark contract. Representation version 1 deliberately uses the concrete
StyleMark preset behavior described above.

## Rows

Rows are the horizontal layout primitive. Their array order is top-to-bottom
body flow. A Row always contains at least one Block.

```ts
interface DocumentRow {
  id: string;
  blocks: DocumentBlock[];   // left-to-right order; non-empty
  layout: RowLayout;
}

interface RowLayout {
  blockGapTwips: number;
  marginBeforeTwips: number;
  marginAfterTwips: number;
  tracks: RowTrack[];
}

interface RowTrack {
  blockId: string;
  /** Positive width units. The Block's horizontal share is
   *  widthUnits / sum(sibling widthUnits). */
  widthUnits: number;
}
```

Tracks are in the same order as `blocks`. Every Block has exactly one track.
Every `widthUnits` value is a positive integer. Most Rows contain one Block
with one width unit.

When a Block is inserted into an existing multi-Block Row, it receives one
width unit unless the operation supplies another positive value. Moving a Block
carries its current width units by default. A sole Block in a Row consumes the
whole available Row width regardless of the stored positive unit value.

## Blocks

Blocks are a closed discriminated union. There is no generic `data: unknown`
payload and no generic Embed Block in representation version 1.

```ts
type RichContent = import("#rich-text").RichContent;
type RichTextOperation = import("#rich-text").RichTextOperation;
type DerivedOutputRef = import("#derived-outputs").DerivedOutputRef;

interface BlockBase {
  id: string;
  /** Live reference to a reusable Document Style. */
  styleId: string;
  /** Optional one-off whole-Block override. */
  presentation?: BlockPresentationOverride;
}

interface TextBlock extends BlockBase {
  kind: "text";
  content: RichContent;
}

interface CodeBlock extends BlockBase {
  kind: "code";
  language?: string;
  content: RichContent;
}

interface QuoteBlock extends BlockBase {
  kind: "quote";
  content: RichContent;
}

interface PromptBlock extends BlockBase {
  kind: "prompt";
  /** Exact immutable revision of this Block's dedicated Derived Output. */
  output: DerivedOutputRef;
}

interface DividerBlock extends BlockBase {
  kind: "divider";
}

interface CalloutBlock extends BlockBase {
  kind: "callout";
  tone: "info" | "success" | "warning" | "danger" | "neutral";
  rows: DocumentRow[];
}

interface ListBlock extends BlockBase {
  kind: "list";
  list: DocumentList;
}

interface TableBlock extends BlockBase {
  kind: "table";
  table: DocumentTable;
}

interface ImageBlock extends BlockBase {
  kind: "image";
  image: ImageBlockData;
}

interface ChartBlock extends BlockBase {
  kind: "chart";
  chart: ChartBlockData;
}

type DocumentBlock =
  | TextBlock
  | CodeBlock
  | QuoteBlock
  | PromptBlock
  | DividerBlock
  | CalloutBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | ChartBlock;
```

There is no Text subkind. A heading is a Text Block whose selected Style carries
one of the protected `heading-1` through `heading-6` system roles. That role
determines outline participation and level. The Style's name and visual recipe
remain fully editable; neither is used to infer heading semantics.

### Rich Content and Formula atoms

Document imports the complete inline contract from Rich Text. Rich Text owns
Formula atoms, the `{{ ... }}` authoring conversion, formula-expression edits,
and formula-result application operations.

```ts
type RichTextAtom = import("#rich-text").RichTextAtom;
type RichTextOperation = import("#rich-text").RichTextOperation;
type TextPosition = import("#rich-text").TextPosition;
type TextRange = import("#rich-text").TextRange;
```

Document does not define a second Formula item type. Its reducer passes the
operation batch to `richText.apply`. The application layer observes affected
Formula atom IDs and creates durable evaluation attempts. Formula evaluation
uses the Platform Formula engine and existing project resolver adapter; serial
settlement applies a Rich Text formula-result operation only when the atom's
expression remains unchanged.

Rich Text exposes `formulaFromDelimitedRange`, a deterministic helper that
converts `{{ source }}` into one atomic `replace-range-with-atom` operation.
The Document layer persists only the returned Rich Text operation batch.

### Prompt Blocks

A Prompt Block stores only a `DerivedOutputRef` to its dedicated output:

```ts
interface DerivedOutputRef {
  outputId: string;
  appliedRevision: number;
}
```

The injected Derived Outputs runtime owns the output definition, instruction,
Context scope, stabilization text, immutable content revisions, evidence,
freshness, and refresh lifecycle. Updating stabilization text therefore does
not create a Document revision. Adopting a newly published output revision does.

Each Prompt Block receives a newly declared Derived Output. Public Document
operations cannot insert a Prompt Block containing an arbitrary existing
`outputId`, and no two live Prompt Blocks may reference the same output. This
keeps definition edits, stabilization text, evidence dependencies, freshness,
and refresh state specific to one placement.

Deleting a Prompt Block does not immediately hard-delete its Derived Output.
Retained Document history may still need the immutable output revision. The
output becomes detached and is eligible for garbage collection only after no
retained Base or ChangeSet can reference it. Any future Document-duplication
workflow must create a new dedicated output for every copied Prompt Block
rather than preserving source output IDs.

## Lists

```ts
interface DocumentList {
  id: string;
  listKind: "bulleted" | "numbered" | "checklist";
  start?: number;          // valid only for numbered lists
  items: ListItem[];
}

interface ListItem {
  id: string;
  checked?: boolean;       // valid only for checklist items
  rows: DocumentRow[];     // non-empty item body
  children: ListItem[];
}
```

List item IDs survive reorder and nesting changes. A checklist item alone may
carry `checked`. A numbered list alone may carry `start`.

## Tables

```ts
interface DocumentTable {
  id: string;
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[];
  merges: TableMerge[];
}

interface TableColumn {
  id: string;
  width: { kind: "auto" } | { kind: "fixed"; twips: number };
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

Every row/column pair has exactly one Cell. A merge covers one rectangular,
non-overlapping set. Merged Cells remain canonical identities but only the root
Cell renders content while the merge is active.

## Images and charts

Visual payloads carry explicit dimensions. Their containing Row track supplies
the available width; the visual dimensions determine the item's size inside
that allocation.

```ts
interface VisualDimensions {
  /** Desired width inside the assigned Block track. Omit to use the track width. */
  widthTwips?: number;
  heightTwips: number;
  lockAspectRatio: boolean;
  horizontalAlign: "left" | "center" | "right" | "stretch";
}

interface ImageBlockData {
  source: MediaSnapshotRef;
  dimensions: VisualDimensions;
  alt: string;
  decorative: boolean;
  crop?: { left: number; top: number; right: number; bottom: number };
  fit: "contain" | "cover" | "stretch";
}

interface MediaSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

interface ChartBlockData {
  source: "literal" | "formula" | "analysis-result" | "structured-data";
  specification: Record<string, unknown>;
  dimensions: VisualDimensions;
  snapshotDigest?: string;
  alt: string;
}
```

`widthTwips` and `heightTwips` must be positive when present. A fixed width may
not exceed the Block's assigned width at render time; the renderer clamps or
reports a layout diagnostic without changing canonical state.

Generic embeds are deferred. A future video, external-resource, or interactive
embed becomes its own typed Block kind with a provider-specific safe payload
and dimensions.

## Identity and recursion invariants

1. Row, Block, list, list-item, table, table-row, table-column, table-cell,
   table-merge, style, Rich Text atom, and Rich Text mark IDs are stable and
   never reused within one Document's retained history.
2. IDs that operations address without a container path—especially Row,
   Block, list, list-item, table, and Formula atom IDs—are globally unique
   across the entire recursive snapshot.
3. Every Row has at least one Block and every Block has exactly one ordered
   track in its containing Row.
4. Callouts cannot contain another Callout at any descendant depth.
5. Lists and Tables may nest only within the configured maximum content depth.
6. Every RichContent value passes Rich Text validation and normalization.
7. Every Block style reference resolves; style inheritance is acyclic.
8. Every Derived Output reference points to a positive immutable revision, and
   every live Prompt Block has a distinct dedicated output ID.

## Deferred from representation version 1

- Exact pagination and persisted page fragments.
- Explicit page-break Rows or Blocks.
- Mid-document page-layout sections.
- Generic embeds.
- Browser selection state and rendered pixel geometry.
- Document duplication; Prompt-bearing copies require an explicit Derived
  Outputs clone contract rather than shared output IDs.
