# Slides capability — canonical model

## Aggregate boundary

Slides owns one versioned Deck aggregate. A Deck owns its canvas size, embedded
Style Registry, ordered Slides, and every structural Group and visual Shape on
those Slides. The project is selected when the runtime is constructed; neither
project nor user identity appears in canonical Slides values.

```ts
type DeckId = string;
type SlideId = string;
type SlideElementId = string;
type SlideGroupId = SlideElementId;
type ShapeId = SlideElementId;

type SlideLifecycle = "active" | "archived" | "trashed";

interface DeckHead {
  id: DeckId;
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
  styles: SlideStyleRegistry;
  slideOrder: SlideId[];
  slides: Record<SlideId, Slide>;
}

interface SlideCanvas {
  widthPt: number;
  heightPt: number;
}
```

The canvas belongs to the Deck, not to individual Slides. Width and height are
finite positive point values. A Deck always contains at least one Slide.
`slideOrder` is the only Slide-order authority: it contains every key in
`slides` exactly once.

There is no separately persisted Theme aggregate in representation version 1.
A template may initialize a Deck's canvas, styles, Slides, and Shapes, but the
copied values become ordinary canonical Deck state.

## Embedded Style Registry

Slides uses the same reusable-style semantics as Document. Style identity and
inheritance live inside the Deck snapshot, so historical revisions never
depend on a mutable external Theme row.

```ts
type SlideShapeKind =
  | "text"
  | "prompt-content"
  | "geometry"
  | "line"
  | "image"
  | "table"
  | "chart";

interface SlideStyleRegistry {
  defaultStyleIdByShapeKind: Record<SlideShapeKind, string>;
  styles: SlideStyle[];
}

interface SlideStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  visual: SlideVisualStyleProperties;
  text: TextStyleProperties;
}

interface SlideVisualStyleProperties {
  opacity?: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  shadow?: ShadowStyle;
}

type FillStyle =
  | { kind: "none" }
  | { kind: "solid"; color: SlideColor };

type StrokeStyle =
  | { kind: "none" }
  | {
      kind: "stroke";
      color: SlideColor;
      widthPt: number;
      dash: "solid" | "dashed" | "dotted";
    };

type ShadowStyle =
  | { kind: "none" }
  | {
      kind: "drop";
      color: SlideColor;
      offsetXPt: number;
      offsetYPt: number;
      blurPt: number;
    };

/** Canonical lowercase #rrggbbaa. */
type SlideColor = string;

interface ShapePresentationOverride {
  visual?: SlideVisualStyleProperties;
  text?: TextStyleProperties;
}
```

Style IDs, rather than names, are stable. Names and properties are editable.
Every Style reference resolves, inheritance is acyclic, and every Shape kind
has a valid default Style. Deleting a Style requires a replacement and rewrites
all references in the same ChangeSet.

For a Shape, style projection proceeds in this order:

1. Resolve the Shape-kind default Style, including inheritance.
2. Overlay the Shape's selected `styleId`, including inheritance.
3. Overlay the Shape's local `presentation` properties.
4. For authored text only, apply inline Rich Text marks as supplementary
   properties: a mark fills properties not fixed by the resolved Shape overlay.

The first three layers form the authoritative full-range Shape overlay. Prompt
Content has no persisted inline marks; its selected Style and presentation
format the exact Derived Output revision's plain text.

## Slides and element ordering

```ts
interface Slide {
  id: SlideId;
  title?: string;
  background: SlideBackground;
  notes: RichContent;
  rootElementIds: SlideElementId[];
  elements: Record<SlideElementId, SlideElement>;
}

type SlideBackground =
  | { kind: "transparent" }
  | { kind: "solid"; color: SlideColor }
  | {
      kind: "image";
      source: ImageSnapshotRef;
      fit: "contain" | "cover" | "stretch";
    };

type SlideElement = SlideGroup | SlideShape;

interface SlideElementBase {
  id: SlideElementId;
  locked: boolean;
  hidden: boolean;
}

interface SlideGroup extends SlideElementBase {
  elementKind: "group";
  childElementIds: SlideElementId[];
}
```

`rootElementIds` and each Group's `childElementIds` are ordered back-to-front:
the first element paints first and the last paints last. Arrays are the only
ordering representation; there are no fractional ranks.

Every element in `elements` occurs exactly once in either `rootElementIds` or
one Group's `childElementIds`. A Group cannot contain itself or an ancestor,
all children belong to the same Slide, and nesting is bounded. Parent identity
is derived from the containing array and is not duplicated on the child.

A Group is structural. It has no frame, fill, stroke, content, or stored
transform. Its bounds are projected as the union of every descendant Shape's
bounds, including hidden descendants. Group movement, resize, rotation, and
flip gestures become explicit descendant Shape frame/transform operations
before admission; only those Shape operations enter history.

`hidden` is inherited for presentation and `locked` is inherited for editing:
a descendant is effectively hidden or locked when it or any ancestor has that
flag. An unlock operation remains permitted on the element that owns the lock.

## Shapes

```ts
interface ShapeBase extends SlideElementBase {
  elementKind: "shape";
  frame: ShapeFrame;
  transform: ShapeTransform;
  styleId: string;
  presentation?: ShapePresentationOverride;
}

interface ShapeFrame {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

interface ShapeTransform {
  /** Canonical range [0, 360), clockwise around the frame center. */
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

type SlideShape =
  | TextShape
  | PromptContentShape
  | GeometryShape
  | LineShape
  | ImageShape
  | TableShape
  | ChartShape;
```

Coordinates use a top-left origin, with positive X to the right and positive Y
down. Every coordinate is finite and every frame dimension is positive.

### Authored Text Shape

```ts
interface TextShape extends ShapeBase {
  shapeKind: "text";
  content: RichContent;
  textBox: TextBoxPresentation;
}

interface TextBoxPresentation {
  paddingPt: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  horizontalAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  overflow: "clip" | "shrink";
}
```

Rich Text owns authored atoms, marks, links, references, formulas, positions,
ranges, validation, normalization, and exact Rich Text inverses. Slides wraps
Rich Text operation batches in a Deck ChangeSet. Text-box padding is finite and
non-negative. `shrink` is a presentation rule and never changes canonical
frame geometry.

### Prompt Content Shape

```ts
interface PromptContentShape extends ShapeBase {
  shapeKind: "prompt-content";
  /** Exact immutable revision of this Shape's dedicated Derived Output. */
  output: DerivedOutputRef;
  textBox: TextBoxPresentation;
}

interface DerivedOutputRef {
  outputId: string;
  appliedRevision: number;
}
```

Prompt Content is a distinct Shape kind, not an alternate source for authored
Text. It stores only an exact positive Derived Output reference plus normal
text-box presentation. Derived Outputs owns the prompt, Context scope,
stabilization text, definition revision, generation, evidence, freshness, and
immutable output revisions.

Every live Prompt Content Shape has its own dedicated output. Generic Shape
insertion, replacement, or source-switch operations cannot introduce a Prompt
Content Shape or caller-supplied output ID. It enters canonical state only
through the staged Prompt Content creation command. Definition changes mutate
Derived Outputs; a Deck revision changes only when Slides adopts a different
exact output revision.

Deleting Prompt Content detaches its output rather than immediately deleting
it because retained Deck history may still reference an immutable revision.
Duplication must declare a new dedicated output for every copied Prompt Content
Shape and is therefore deferred from representation version 1.

### Geometry Shape

```ts
interface GeometryShape extends ShapeBase {
  shapeKind: "geometry";
  geometry:
    | { kind: "rectangle" }
    | { kind: "rounded-rectangle"; cornerRadiusPt: number }
    | { kind: "ellipse" }
    | { kind: "triangle" }
    | { kind: "diamond" }
    | { kind: "arrow" };
}
```

Custom paths and arbitrary SVG are not part of v1.

### Straight Line Shape

```ts
interface LineShape extends ShapeBase {
  shapeKind: "line";
  line: {
    start: UnitPoint;
    end: UnitPoint;
    startDecoration: LineDecoration;
    endDecoration: LineDecoration;
  };
}

interface UnitPoint {
  /** Local frame coordinate in the inclusive range [0, 1]. */
  x: number;
  y: number;
}

type LineDecoration = "none" | "arrow" | "circle" | "diamond";
```

Lines are straight in v1. Local unit coordinates allow horizontal and vertical
lines while retaining a positive canonical frame. Elbow and curved routing are
deferred until their geometry is specified precisely.

### Image Shape

```ts
interface ImageSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

interface ImageShape extends ShapeBase {
  shapeKind: "image";
  image: {
    source: ImageSnapshotRef;
    crop?: NormalizedCrop;
    fit: "contain" | "cover" | "stretch";
    alt: string;
    decorative: boolean;
  };
}

interface NormalizedCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
```

Crop edges are fractions in `[0, 1)` and opposing edges must sum to less than
one. Slides persists an immutable source reference, not image bytes and not a
mutable Media identity. No Media runtime is needed for canonical editing.

### Literal Table and Chart Shapes

```ts
type FormulaWireValue = import("#formula").FormulaWireValue;

interface AcceptedSlideValue {
  /** Bounded, JSON-safe value copied into the Deck revision. */
  value: FormulaWireValue;
}

interface TableShape extends ShapeBase {
  shapeKind: "table";
  table: {
    accepted: AcceptedSlideValue;
    presentation: {
      headerRow: boolean;
      bandedRows: boolean;
      firstColumnHeader: boolean;
      lastColumnFooter: boolean;
      columnWidthsPt?: number[];
    };
  };
}

interface ChartShape extends ShapeBase {
  shapeKind: "chart";
  chart: {
    accepted: AcceptedSlideValue;
    specification: {
      kind: "bar" | "line" | "pie" | "scatter" | "area";
      title?: string;
      xAxis?: { label?: string; min?: number; max?: number };
      yAxis?: { label?: string; min?: number; max?: number };
      legend: { position: "top" | "bottom" | "left" | "right" | "none" };
      colors?: SlideColor[];
    };
  };
}
```

Table values must be tabular; chart values must be a bounded list, record, or
table. The accepted value is canonical
and historical: Slides does not resolve Formula, Structured Data, analysis, or
other mutable sources while reading a Deck. A future linked-source feature must
freeze a source, compute outside the serial transaction, and conditionally
settle a copied accepted value through an ordinary ChangeSet.

## Placement

```ts
interface ElementPlacement {
  /** Omitted means the Slide root. */
  parentGroupId?: SlideGroupId;
  /** Omitted means first/backmost in the selected container. */
  afterElementId?: SlideElementId;
}
```

The anchor must be an immediate child of the exact target container. Moving an
element removes it from its old container and inserts it once in the new one.
Grouping requires contiguous siblings, preserves their order, and replaces
them with the new Group at the first selected position. Ungrouping replaces the
Group with its ordered children.

## Identity and structural invariants

1. Slide, Group, Shape, Style, Rich Text atom, and Rich Text mark IDs are
   stable and cannot be reused within retained Deck history.
2. A durable identity ledger tombstones deleted IDs. Exact compensation may
   reactivate an ID only with its original identity kind.
3. `slideOrder` contains every Slide exactly once and a Deck is never empty.
4. Every Slide element is reachable exactly once from its root ordering tree;
   there are no missing elements, duplicate memberships, or cycles.
5. Groups are structural, non-empty in a committed snapshot, and nesting does
   not exceed the configured limit.
6. Every Shape frame and kind-specific payload is finite, bounded, and valid.
7. Every Style reference resolves and Style inheritance is acyclic.
8. Every Rich Content value passes Rich Text validation and normalization.
9. Every Prompt Content reference selects a positive immutable revision, and
   no two live Prompt Content Shapes share an output ID.
10. Locked and hidden inheritance, ordering, and group bounds are projections
    of canonical element state; they do not create additional stored geometry.

## Deferred from representation version 1

- Mutable external Themes, token registries, master Slides, and layout placeholders.
- Deck, Slide, Group, or Prompt Content duplication.
- Stored group transforms.
- Custom paths, arbitrary SVG, gradients, curved lines, and elbow routing.
- Live Formula, Structured Data, analysis, or Media runtime integration.
- Renderers, thumbnails, export files, render caches, and pixel geometry.
- Animations, transitions, video, audio, and generic embeds.
- Real-time presence and Activity publishing beyond a durable accepted-fact outbox.
