# Slides capability — canonical model

## Aggregate boundary

Slides owns one versioned `DeckSnapshot`. The complete design system, reusable
master/layout resources, Slides, elements, and authored Rich Content required
to reconstruct a historical revision live inside that snapshot. Project ID
selects the runtime and store at construction; neither project nor user identity
appears in canonical Slides values.

```ts
type DeckId = string;
type SlideId = string;
type MasterSlideId = string;
type SlideLayoutId = string;
type LayoutSlotId = string;
type SlideElementId = string;
type SlideGroupId = SlideElementId;
type DesignTokenId = string;

type SlideLifecycle = "active" | "archived" | "trashed";
type RichContent = import("#rich-text").RichContent;
type DerivedOutputRef = import("#derived-outputs").DerivedOutputRef;

interface DeckHead {
  id: DeckId;
  /** Plain-text projection of DeckSnapshot.title for list queries. */
  title: string;
  lifecycle: SlideLifecycle;
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

interface DeckSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: SlideLifecycle;
  canvas: SlideCanvas;
  design: DeckDesignSystem;
  slideOrder: SlideId[];
  slides: Record<SlideId, Slide>;
}

interface SlideCanvas {
  widthPt: number;
  heightPt: number;
}

interface DeckDesignSystem {
  /** One embedded, revisioned Theme value—not an external Theme aggregate. */
  theme: DeckTheme;
  textStyles: SlideTextStyleRegistry;
  masters: Record<MasterSlideId, MasterSlide>;
  /** Layouts are the Deck's reusable Slide templates in representation v1. */
  layouts: Record<SlideLayoutId, SlideLayout>;
}
```

Deck title, optional Slide title, and image alternative text are plain metadata
or accessibility strings. Visual authored content—Slide notes, Text elements,
Table cells, and Chart titles and labels—is `RichContent`. Administrative
labels—Style, token, Master, Layout, and slot names, font-family names, MIME
types, and resource keys—are also plain strings because they identify
configuration rather than presented Slide content. Prompt Content owns no text
copy; it owns an immutable Derived Output reference.

## Embedded Theme and typed design tokens

The singleton Deck Theme owns the token registry plus the Deck's palette and
typography defaults. Master and Layout registries are sibling design resources
under `DeckDesignSystem`; they are not Theme children.

```ts
interface DeckTheme {
  name: string;
  tokens: Record<DesignTokenId, DeckDesignToken>;
  palette: DeckThemePalette;
  typography: DeckThemeTypography;
}

type DeckDesignToken =
  | ThemeColorToken
  | ThemeFontToken
  | ThemeLengthToken;

interface ThemeColorToken {
  id: DesignTokenId;
  kind: "color";
  name: string;
  value: SlideColor;
}

interface ThemeFontToken {
  id: DesignTokenId;
  kind: "font";
  name: string;
  family: string;
}

interface ThemeLengthToken {
  id: DesignTokenId;
  kind: "length";
  name: string;
  valuePt: number;
}

type ThemeColorValue =
  | { kind: "literal"; value: SlideColor }
  | { kind: "token"; tokenId: DesignTokenId };

type ThemeFontValue =
  | { kind: "literal"; family: string }
  | { kind: "token"; tokenId: DesignTokenId };

type ThemeLengthValue =
  | { kind: "literal"; valuePt: number }
  | { kind: "token"; tokenId: DesignTokenId };

interface DeckThemePalette {
  canvas: ThemeColorValue;
  background: ThemeColorValue;
  surface: ThemeColorValue;
  text: ThemeColorValue;
  mutedText: ThemeColorValue;
  accents: ThemeColorValue[];
}

interface DeckThemeTypography {
  bodyFont: ThemeFontValue;
  displayFont: ThemeFontValue;
  bodySize: ThemeLengthValue;
  displaySize: ThemeLengthValue;
}

/** Canonical lowercase #rrggbbaa. */
type SlideColor = string;
```

A token reference must resolve to a token of the matching kind. Token identity,
not name, is stable. Literal values and token references are both intentional:
token references update live when a token changes, while literals pin a local
choice. Tokens do not alias other tokens in representation v1, so resolution
cannot cycle. Colors, point values, opacity, and other numbers must be finite;
length values used for visible dimensions or stroke widths must be positive.

## Text Style Registry

Slides has reusable text styles only. It does not have a generic Shape Style or
an element-kind default Style map. Geometry, line, image, table, and chart
appearance is typed directly on the owning element and may reference Theme
tokens.

```ts
interface SlideTextStyleRegistry {
  normal: NormalSlideTextStyle;
}

interface NormalSlideTextStyle {
  name: string;
  text: SlideTextStyleProperties;
  systemRole: "normal";
}

interface SlideTextStyleProperties {
  fontFamily?: ThemeFontValue;
  fontSize?: ThemeLengthValue;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: ThemeColorValue;
  background?: ThemeColorValue;
  letterSpacing?: ThemeLengthValue;
  lineHeight?: number;
}
```

A Deck contains exactly one protected Normal Style. It is a fixed singleton,
not an entry selected by ID: callers cannot add, delete, replace, or reassign
text Styles, and text-bearing surfaces carry no Style selection field. Normal's
display name and text properties may be edited.

For any text-bearing element or Table cell, text styling resolves in this
order:

1. Rich Text global fallbacks.
2. The Deck's Normal Style, which is the universal full-range overlay.
3. The element's typed text-box or cell presentation properties.
4. Stored inline Rich Text marks as supplementary formatting.

The resolved Normal Style becomes an ephemeral full-range Rich Text overlay and
is never written into `RichContent`. One-off range formatting remains an
ordinary Rich Text Style Mark. Rich Text's Link Mark remains the navigation/
link facility and is unrelated to the Deck's Normal Style.

## Master Slides, Layouts, and live inheritance

```ts
type SlideElementStore = Record<SlideElementId, SlideElement>;

interface MasterSlide {
  id: MasterSlideId;
  name: string;
  background?: SlideBackground;
  elements: SlideElementStore;
}

interface SlideLayout {
  id: SlideLayoutId;
  name: string;
  masterSlideId: MasterSlideId;
  background?: SlideBackground;
  elements: SlideElementStore;
  slots: Record<LayoutSlotId, LayoutSlot>;
}

interface LayoutSlot {
  id: LayoutSlotId;
  name: string;
  frame: ElementFrame;
  acceptedKinds: FramedElementKind[];
  required: boolean;
}

interface Slide {
  id: SlideId;
  title?: string;
  layoutId: SlideLayoutId;
  background?: SlideBackground;
  notes: RichContent;
  elements: SlideElementStore;
}

type SlideBackground =
  | { kind: "transparent" }
  | { kind: "solid"; color: ThemeColorValue }
  | {
      kind: "image";
      source: ImageSnapshotRef;
      fit: "contain" | "cover" | "stretch";
    };
```

A Layout references one Master, and a Slide references one Layout. These are
live links: the Master is not copied into the Layout, and neither resource is
copied into the Slide. At revision `r`, effective composition is:

```text
Theme background
  → Master background and elements
  → Layout background and elements
  → Slide background and elements
```

The most-derived present background wins. Inherited resources are evaluated
from the same Deck revision, so history never depends on a mutable external
template. Deleting a referenced Master or Layout requires a replacement and
rewrites all live references in the same ChangeSet.

A Layout slot is a stable, non-painting metadata placement anchor. It owns one
frame but no content, text-Style selection, or `zIndex`. A Slide-owned framed root element
may follow it through a discriminated placement (defined below). The element
then has no duplicate frame and follows slot edits live. At most one live
element binds a given slot, the element kind must be accepted, and a slot-bound
element cannot also be inside a Group. Moving or resizing it explicitly
detaches it to a free placement initialized with the slot's currently resolved
frame.

Representation v1 treats Layouts as the Deck's reusable Slide templates; there
is no third copied-template registry.

## Flat element stores and placement

Master, Layout, and Slide element stores use the same heterogeneous union. Each
store is one flat record. Groups do not carry child arrays and owners do not
carry root-element arrays.

```ts
type ElementOwner =
  | { kind: "master"; masterSlideId: MasterSlideId }
  | { kind: "layout"; layoutId: SlideLayoutId }
  | { kind: "slide"; slideId: SlideId };

type SlideElementKind = SlideElement["kind"];
type FramedElementKind = Exclude<SlideElementKind, "group" | "straight-line">;

interface SlideElementBase {
  id: SlideElementId;
  kind: SlideElementKind;
  /** Null identifies the owner's root; otherwise membership is in this Group. */
  parentGroupId: SlideGroupId | null;
  /** Unique contiguous sibling index, back-to-front. */
  zIndex: number;
  locked: boolean;
  hidden: boolean;
}

interface ElementFrame {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

type FramedElementPlacement =
  | { kind: "free"; frame: ElementFrame }
  | { kind: "layout-slot"; slotId: LayoutSlotId };

interface FreePointPlacement {
  kind: "free";
  xPt: number;
  yPt: number;
}

interface FramedSlideElementBase extends SlideElementBase {
  placement: FramedElementPlacement;
  transform: ElementTransform;
}

interface ElementTransform {
  /** Canonical range [0, 360), clockwise around the resolved frame center. */
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}
```

For free root elements, coordinates are relative to the owner canvas. For
Group children, coordinates are relative to their parent Group's local origin.
For slot-bound framed elements, the effective frame is the live slot frame.
All coordinates are finite, all frames have positive dimensions, and free
placements are mandatory for Master/Layout elements and Group children.

`zIndex` is the sole element-order authority. For every owner root and every
Group, sibling z-indices are unique and contiguous `0..n-1`; zero is backmost.
Insertion, move, deletion, grouping, and ungrouping renumber the affected
sibling set deterministically. There are no fractional ranks, root order
arrays, child order arrays, or duplicated parent indexes.

An element can reference a parent only in its own flat store. Parent graphs are
acyclic and bounded. A Group is non-empty in committed state; deleting or
moving its last child prunes the empty Group in the same ChangeSet. `hidden`
and `locked` project through ancestors. Element IDs are unique across all
Master, Layout, and Slide stores in one Deck, so operation targets never need a
fragile recursive path even though `ElementOwner` identifies the store.

The three inheritance planes have a fixed back-to-front order: Master, Layout,
then Slide. `zIndex` orders siblings inside one plane; it does not interleave
elements across planes. This is an explicit representation-v1 assumption and
is called out under open questions.

## Heterogeneous `SlideElement` union

```ts
type SlideElement =
  | SlideGroupElement
  | SlideTextElement
  | PromptContentElement
  | GeometryElement
  | StraightLineElement
  | ImageElement
  | TableElement
  | ChartElement;

interface SlideGroupElement extends SlideElementBase {
  kind: "group";
  placement: FreePointPlacement;
}

interface SlideTextElement extends FramedSlideElementBase {
  kind: "text";
  content: RichContent;
  textBox: TextBoxPresentation;
}

interface PromptContentElement extends FramedSlideElementBase {
  kind: "prompt-content";
  /** Exact immutable revision of this element's dedicated Derived Output. */
  output: DerivedOutputRef;
  textBox: TextBoxPresentation;
}

interface GeometryElement extends FramedSlideElementBase {
  kind: "geometry";
  geometry: GeometryPrimitive;
  appearance: GeometryAppearance;
}

interface StraightLineElement extends SlideElementBase {
  kind: "straight-line";
  placement: FreePointPlacement;
  deltaXPt: number;
  deltaYPt: number;
  appearance: LineAppearance;
  startDecoration: LineDecoration;
  endDecoration: LineDecoration;
}

interface ImageElement extends FramedSlideElementBase {
  kind: "image";
  image: ImageElementData;
}

interface TableElement extends FramedSlideElementBase {
  kind: "table";
  table: SlideTable;
}

interface ChartElement extends FramedSlideElementBase {
  kind: "chart";
  chart: SlideChart;
}
```

The union is direct: Text, Prompt Content, Geometry, Straight Line, Image,
Table, and Chart are elements, not payload subtypes hidden inside a universal
Shape. Group is structural and the other kinds carry only their own typed
appearance/content contracts.

### Group

A Group's free point is a local translation; it has no fill, stroke, content,
frame, rotation, scale, or child array. Its effective bounds are projected from
all descendants, including hidden ones. Moving a Group changes its point.
Resizing, rotating, or flipping a Group gesture is expanded into explicit
descendant operations before admission.

### Text and Prompt Content

```ts
interface TextBoxPresentation {
  paddingPt: { top: number; right: number; bottom: number; left: number };
  horizontalAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  overflow: "clip" | "shrink";
}
```

Rich Text owns authored atoms, marks, links, references, Formula atoms,
positions, ranges, validation, normalization, and exact inverses. Slides wraps
ordinary Rich Text operation batches in a Deck ChangeSet.

Prompt Content is not alternate Text content. It stores only an exact
`DerivedOutputRef` and text-box presentation; Normal supplies the text Style.
Every Prompt Content element owns a new dedicated Derived Output;
no two live elements share an `outputId`, and generic element insert/replace
operations cannot introduce one or attach a caller-supplied output. Derived
Outputs owns the definition, instruction, Context scope, stabilization text,
evidence, freshness, generation, and immutable content revisions. Updating
those values does not revise the Deck; adopting a new exact output revision
does.

Prompt creation, refresh, definition update, stabilization update, detachment,
and retained-history ownership use the same staged Derived Outputs boundary as
Document. A serial freeze persists an attempt, concurrent work declares or
refreshes the dedicated output, and serial settlement conditionally writes the
exact accepted reference through an ordinary ChangeSet. Accepted mutations
also write the Slides activity outbox fact in the same store transaction.

### Geometry and Straight Line

```ts
type GeometryPrimitive =
  | { kind: "rectangle" }
  | { kind: "rounded-rectangle"; cornerRadiusPt: number }
  | { kind: "ellipse" }
  | { kind: "triangle" }
  | { kind: "diamond" }
  | { kind: "arrow" };

interface GeometryAppearance {
  opacity?: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  shadow?: ShadowStyle;
}

type FillStyle =
  | { kind: "none" }
  | { kind: "solid"; color: ThemeColorValue };

type StrokeStyle =
  | { kind: "none" }
  | {
      kind: "stroke";
      color: ThemeColorValue;
      width: ThemeLengthValue;
      dash: "solid" | "dashed" | "dotted";
    };

type ShadowStyle =
  | { kind: "none" }
  | {
      kind: "drop";
      color: ThemeColorValue;
      offsetX: ThemeLengthValue;
      offsetY: ThemeLengthValue;
      blur: ThemeLengthValue;
    };

interface LineAppearance {
  opacity?: number;
  stroke: Exclude<StrokeStyle, { kind: "none" }>;
}

type LineDecoration = "none" | "arrow" | "circle" | "diamond";
```

A Straight Line starts at its free point and ends at point plus `(deltaXPt,
deltaYPt)`. The deltas are finite and cannot both be zero. Only straight lines
and the bounded Geometry primitive set are canonical in v1.

### Image

```ts
interface ImageSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

interface ImageElementData {
  source: ImageSnapshotRef;
  crop?: NormalizedCrop;
  fit: "contain" | "cover" | "stretch";
  alt: string;
  decorative: boolean;
}

interface NormalizedCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
```

Slides stores an immutable General Files snapshot reference, not file bytes or
a mutable file identity. Crop edges are fractions in `[0, 1)`, and opposing
edges sum to less than one. Image alternative text is a plain accessibility
string; a decorative image carries an empty `alt` string.

### Table

```ts
type TableRowId = string;
type TableColumnId = string;
type TableCellId = string;
type TableMergeId = string;

interface SlideTable {
  rowOrder: TableRowId[];
  rows: Record<TableRowId, SlideTableRow>;
  columnOrder: TableColumnId[];
  columns: Record<TableColumnId, SlideTableColumn>;
  cells: Record<TableCellId, SlideTableCell>;
  merges: Record<TableMergeId, SlideTableMerge>;
}

interface SlideTableRow {
  id: TableRowId;
  height?: ThemeLengthValue;
}

interface SlideTableColumn {
  id: TableColumnId;
  width: ThemeLengthValue;
}

interface SlideTableCell {
  id: TableCellId;
  rowId: TableRowId;
  columnId: TableColumnId;
  content: RichContent;
  fill?: FillStyle;
  borders?: TableCellBorders;
  paddingPt: { top: number; right: number; bottom: number; left: number };
  horizontalAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
}

interface TableCellBorders {
  top?: StrokeStyle;
  right?: StrokeStyle;
  bottom?: StrokeStyle;
  left?: StrokeStyle;
}

interface SlideTableMerge {
  id: TableMergeId;
  anchorCellId: TableCellId;
  /** Row-major rectangular region, including the anchor. */
  cellIds: TableCellId[];
}
```

Row and column order arrays are the only order authorities inside a Table.
Every row/column cross-product has exactly one stable Cell identity. Every cell
owns independent Rich Content plus optional fill, four borders, padding, and
alignment; Normal supplies its text Style. Merge regions are rectangular, disjoint, contain at
least two cells, and keep all covered Cell identities; the anchor's Rich
Content is presented while covered content remains canonical for exact
unmerge/undo. Table merge IDs are permanent identities and merge/unmerge are
first-class operations.

### Chart

```ts
type ChartCategoryId = string;
type ChartSeriesId = string;

interface SlideChart {
  kind: "bar" | "line" | "pie" | "scatter" | "area";
  title?: RichContent;
  categories: SlideChartCategory[];
  series: SlideChartSeries[];
  xAxis: SlideChartAxis;
  yAxis: SlideChartAxis;
  legend: { position: "top" | "bottom" | "left" | "right" | "none" };
  colors?: ThemeColorValue[];
}

interface SlideChartCategory {
  id: ChartCategoryId;
  label: RichContent;
}

interface SlideChartSeries {
  id: ChartSeriesId;
  name: RichContent;
  /** Finite literal values aligned one-to-one with categories. */
  values: number[];
}

interface SlideChartAxis {
  title?: RichContent;
  min?: number;
  max?: number;
}
```

Chart numeric series are bounded literal canonical values in v1. Series values
align with categories and all values and axis bounds are finite. Formula atoms
may occur in Chart titles, axis titles, category labels, and series names
because those fields are Rich Content; Formula- or Structured-Data-backed
numeric series require a separate frozen-source settlement contract and are
not part of v1.

## Rich Content targets and Formula workflow

Every Rich Text operation addresses one closed target union:

```ts
type RichContentTarget =
  | { kind: "slide-notes"; slideId: SlideId }
  | { kind: "element-text"; owner: ElementOwner; elementId: SlideElementId }
  | {
      kind: "table-cell";
      owner: ElementOwner;
      elementId: SlideElementId;
      cellId: TableCellId;
    }
  | { kind: "chart-title"; owner: ElementOwner; elementId: SlideElementId }
  | {
      kind: "chart-axis-title";
      owner: ElementOwner;
      elementId: SlideElementId;
      axis: "x" | "y";
    }
  | {
      kind: "chart-category-label";
      owner: ElementOwner;
      elementId: SlideElementId;
      categoryId: ChartCategoryId;
    }
  | {
      kind: "chart-series-name";
      owner: ElementOwner;
      elementId: SlideElementId;
      seriesId: ChartSeriesId;
    };
```

The target must resolve to the exact compatible field; a discriminant cannot
be used to reinterpret another element kind. Prompt Content is absent because
its text is owned by Derived Outputs.

Slides uses Document's Rich Text/Formula workflow rather than defining a Slide
Formula type:

1. Rich Text applies authored operations. Its deterministic
   `formulaFromDelimitedRange` helper converts `{{ source }}` into one Formula
   atom operation; Slides never parses the braces or expression.
2. Serial admission observes every created or changed Formula atom and persists
   a durable evaluation attempt beside the Deck ChangeSet and activity fact.
3. Concurrent compute uses the injected Formula engine and one immutable
   project resolver snapshot. Structured Data is reached through that existing
   resolver chain, not imported as Slide state.
4. Serial settlement rechecks the target, Formula atom ID, and frozen
   expression digest, then applies Rich Text's normal Formula-result or
   diagnostic operation through another Deck ChangeSet.

Formula errors live in the Rich Text Formula atom diagnostic contract.
Evaluation attempts and internal compute/settle Jobs persist enough frozen
state for idempotent retries and do not hold a Slides transaction while calling
Formula or Structured Data.

## Identity and representation-v1 invariants

1. A Deck has one positive canvas, one embedded Theme, exactly one protected
   Normal text Style, at least one Master, at least one Layout, and at least one
   Slide.
2. `slideOrder` contains every Slide exactly once.
3. Every Layout references a live Master; every Slide references a live Layout.
4. Each Master/Layout/Slide element store is flat. Each element is either at
   the owner root or names one same-store Group through `parentGroupId`.
5. For every element sibling set, `zIndex` is unique and contiguous `0..n-1`.
6. Groups are non-empty, acyclic, bounded in depth, and own no child arrays.
7. Slot bindings are slide-root-only, kind-compatible, one-to-one, and carry no
   duplicate frame.
8. Every Theme token reference resolves with the required kind, and the fixed
   Normal Style is present exactly once.
9. Every Rich Content value passes Rich Text validation and normalization.
10. Every live Prompt Content element has one distinct dedicated Derived Output
    at a positive immutable revision.
11. Slide, Master, Layout, slot, element, token, table, merge, chart,
    Rich Text atom, and Rich Text mark IDs are never reused within retained Deck
    history. Exact same-kind compensation may reactivate only the same ID.
12. Historical behavior depends only on the Deck revision and exact immutable
    resource/output references stored by that revision.

## Outside the Slides backend domain

Rendering, thumbnails, exports, render caches, pixel geometry, animation, and
transition behavior are explicitly outside this backend capability's domain.
They are not unfinished canonical-model features and are therefore not listed
as representation-v1 deferrals.

## Deferred from representation version 1

- Deck/Slide/Group/Prompt duplication; Prompt copies require new dedicated
  Derived Outputs.
- External/shared Theme resources and token alias chains.
- A separate template resource beyond live deck-owned Layouts.
- Cross-inheritance-plane element interleaving.
- Stored Group rotation/scale and arbitrary transformed coordinate systems.
- Custom paths, arbitrary SVG, gradients, curved lines, and elbow routing.
- Formula- or Structured-Data-backed Chart numeric series.
- Generic embeds, video, and audio element kinds.
- Activity publishing/management beyond the durable accepted-fact outbox.

## Explicit assumptions and open questions

The model above makes these decisions so implementation can begin without an
implicit gap:

1. **Layouts are templates.** Representation v1 has Master and Layout
   registries but no third template registry. Confirm whether a separate named
   template concept is needed later.
2. **Inheritance planes do not interleave.** Master is always behind Layout,
   which is always behind Slide; `zIndex` is local to an element sibling set.
   Confirm whether a Slide element must ever appear behind a Master/Layout
   element. Supporting that would require a cross-plane stacking contract.
3. **One element per slot.** A slot binds at most one framed Slide root element
   and owns the entire live frame. Confirm whether multi-element slot contents
   are required.
4. **Groups translate only.** A Group stores a local origin; compound resize or
   rotation is expanded over descendants. Confirm whether retained Group
   transforms are required for fidelity with imported decks.
5. **Chart values are literal.** Rich Content labels can contain Formula atoms,
   but numeric series do not yet bind Formula/Structured Data. Confirm the
   eventual expected result shape before adding that staged workflow.
6. **Prompt output text remains external.** `DerivedOutputRef` points to the
   current plain-text Derived Output contract, and Slides projects it using the
   Normal Style without copying it into Rich Content. Slides detaches references
   when content is removed but never deletes or garbage-collects Derived Outputs.
   If Derived Outputs
   later exposes Rich Content, that should be a versioned interface change.
