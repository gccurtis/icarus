# Document Layout and Capacity Estimation

## Objective

The first layout implementation answers two practical questions:

1. How many average characters fit on one rendered line in a Block?
2. How many lines of that Block's resolved text style fit in a page's usable
   vertical area?

It then uses actual Display Content line lengths to estimate Row heights and
page placement. It does not claim to perform final glyph measurement or print
pagination.

## Usable Page Geometry

Page geometry is mutable authored state:

```text
usablePageWidthPt = page.widthPt
                  - page.margins.leftPt
                  - page.margins.rightPt

usablePageHeightPt = page.heightPt
                   - page.margins.topPt
                   - page.margins.bottomPt
```

Every page update recomputes the layout projection. Page settings do not store
old or “default” character measurements.

## Row-Owned Normalized Widths

Blocks inside a content Row share usable page width through Row-owned tracks.
Floating-point proportions are derived; fixed integer units are canonical:

```ts
export const FULL_ROW_WIDTH_UNITS = 1_000_000;

export interface DocumentRowTrack {
  readonly blockId: DocumentBlockId;
  readonly widthUnits: number;
}

widthProportion = track.widthUnits / FULL_ROW_WIDTH_UNITS
blockWidthPt = usablePageWidthPt * widthProportion
```

For each Row:

- there is exactly one track for every Block and no other track;
- every `widthUnits` is a positive integer;
- all track units sum to `1_000_000`.

Horizontal Rule and Page Break Rows contain one full-width track.

## Width Normalization

Mutation inputs may provide any positive finite weights. Document normalizes
them deterministically:

```text
normalizeWidths(blockIds, positiveWeights)
  1. Require exactly one weight for every Block in the Row.
  2. Reject non-finite, zero, or negative weights.
  3. Divide each weight by the sum of all weights.
  4. Multiply each ratio by FULL_ROW_WIDTH_UNITS.
  5. Take the integer floor of every result.
  6. Distribute remaining units by largest fractional remainder.
     6.1. Break equal remainders by current Block order.
  7. Return units that sum exactly to FULL_ROW_WIDTH_UNITS.
```

`[1, 1, 1]`, `[10, 10, 10]`, and `[0.5, 0.5, 0.5]` therefore produce the same
canonical widths.

## Width Behavior During Structural Edits

- Inserting a Block without a complete width set redistributes the Row equally.
- Deleting a Block redistributes its units proportionally among survivors.
- Moving within a Row preserves ratios and re-normalizes.
- Moving into another Row uses equal destination widths unless the caller
  supplies the complete destination weight set.
- Moving the final Block out deletes the empty source Row.
- Structural full-width Rows do not accept width mutations.

## Font-Size-Derived Character Metrics

Average character metrics begin with the resolved Block-wide Rich Content font
size. They are not independent page settings.

The first estimator uses explicit, replaceable constants:

```ts
export const INITIAL_CHARACTER_WIDTH_FACTOR = 0.5;
export const INITIAL_CHARACTER_HEIGHT_FACTOR = 1;

estimatedCharacterWidthPt = resolvedFontSizePt
                          * INITIAL_CHARACTER_WIDTH_FACTOR

estimatedCharacterHeightPt = resolvedFontSizePt
                           * INITIAL_CHARACTER_HEIGHT_FACTOR
```

This assumes an average character is half as wide as the declared font size and
one font-size unit high. The factors belong to layout policy, not persisted
Document state. A later font-metrics capability can replace the estimator.

Rich Content font-size values used by Document must have defined point
semantics. Adding Document therefore requires clarifying or adapting the
current Rich Content `fontSize` property at the integration boundary.

If inline Rich Content marks change font size, the first increment uses the
largest resolved font size present on a display line for that line's height and
may sum segment-specific character widths for a refined width estimate. Before
that refinement exists, the Block-wide resolved font size remains the
conservative initial estimate.

## Characters Per Line

For each Rich Content Block:

```text
estimatedCharactersPerLine = max(
  1,
  floor(blockWidthPt / estimatedCharacterWidthPt)
)
```

List marker and separator text counts toward display width even though it is
not editable canonical text.

The estimate is exposed on `DisplayRichContentBlock` so a consumer can
understand the backend's layout conclusion.

## Line Height and Lines Per Page

Line spacing belongs to the Block's resolved Document styling:

```text
estimatedLineHeightPt = estimatedCharacterHeightPt
                      * resolvedLineSpacing

estimatedLinesPerPage = max(
  1,
  floor(usablePageHeightPt / estimatedLineHeightPt)
)
```

Different Blocks may therefore have different line capacities on the same page
because their font sizes or line spacing differ.

## Wrapped Line and Row Height Estimation

```text
estimatedWrappedLines(displayLine) = max(
  1,
  ceil(estimatedDisplayCharacters / estimatedCharactersPerLine)
)

estimatedBlockHeightPt = sum(
  estimatedWrappedLines(line) * estimatedLineHeightPt
)

estimatedRowHeightPt = max(estimatedBlockHeightPt for each Block)
```

An empty Rich Content Block has one estimated display line, preserving an
editable caret area. Side-by-side Blocks share a Row height equal to the tallest
Block estimate.

## Page Placement

Rows are considered in Document order:

```text
placeRows(rows)
  1. Start pageIndex 0 with usablePageHeightPt remaining.
  2. Estimate the next Row's height.
  || Row is a Page Break
     2.a.1. End the current page immediately.
     2.a.2. Start the following Row on pageIndex + 1.
  || Row fits remaining height
     2.b.1. Place it and subtract its height.
  || Row does not fit
     2.c.1. Start a new page.
     2.c.2. Place the Row at the new top boundary.
  3. Record pageIndex on DisplayDocumentRow.
```

A Horizontal Rule Row contributes its configured thickness plus any future
vertical spacing; in the first increment it contributes its thickness only.

A Row taller than a full page is assigned to the current new page and reported
as overflowing. Splitting a Row across pages is deferred.

## Text Alignment

Alignment is relational Document styling scoped to a Rich Content Block:

- `start`: align with writing-direction start;
- `center`: center each rendered line;
- `end`: align with writing-direction end;
- `justify`: distribute space across eligible lines.

Document stores and resolves the intent but does not calculate final glyph
positions. Frontend and export renderers apply it inside the Block width.

## Non-Goals

The first estimator does not provide:

- authoritative font metrics or kerning;
- language-aware word breaking or hyphenation;
- exact glyph placement;
- Row splitting across pages;
- widow/orphan or keep-together rules;
- headers, footers, or page-number content;
- vertical alignment among side-by-side Blocks;
- responsive layouts or nested Rows.

