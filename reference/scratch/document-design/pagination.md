# Document capability — page-layout and pagination boundary

## Decision

Representation version 1 stores **page-layout intent**, but does not promise or
implement exact pagination.

Canonical Document state includes:

- page width and height;
- portrait or landscape orientation;
- top, right, bottom, and left margins;
- page-number start and format;
- Row order, Row gaps/margins, Block tracks, and visual dimensions;
- Block style and presentation properties that will affect future layout.

It does not include:

- computed page count;
- line breaks or page fragment boundaries;
- character or Block page coordinates;
- browser layout nodes or rendered pixels;
- persisted font metrics;
- a page-count endpoint or pagination Job.

This keeps the authored model ready for pagination without claiming that a
fixed character-width estimate is equivalent to actual layout.

## Why exact pagination is deferred

Exact pagination must eventually account for more than page width and plain
text length:

- resolved Document Styles and inline Rich Text marks;
- real font metrics, shaping, Unicode, and line breaking;
- Code and Quote treatments;
- multi-Block Row height, where sibling height is generally the maximum rather
  than the sum;
- nested List, Table, Callout, and table-cell width propagation;
- explicit Image and Chart dimensions;
- keep-together and keep-with-next behavior;
- headers, footers, footnotes, and future page-break semantics;
- export renderer differences and font availability.

A standard-character estimate may still be useful later as a cheap diagnostic,
but it will be named and versioned as an estimate rather than exposed as exact
pagination.

## Initial page-layout validation

The initial domain validates only canonical geometry:

```ts
function validatePageLayout(layout: DocumentPageLayout): ValidationResult;
function computeUsablePageWidth(layout: DocumentPageLayout): number;
function computeUsablePageHeight(layout: DocumentPageLayout): number;
function computeAssignedBlockWidth(
  row: DocumentRow,
  blockId: string,
  usableContainerWidthTwips: number,
): number;
```

Validation rules:

1. Page width and height are positive integers.
2. Margins, Row gaps, and Row margins are non-negative integers.
3. Left plus right margins leave positive usable width.
4. Top plus bottom margins leave positive usable height.
5. Portrait means `heightTwips >= widthTwips`; landscape means the reverse.
6. Every Row track has positive integer width units.
7. Total Block gaps do not consume the entire containing width.
8. Visual dimensions are positive and render within the assigned Block track
   or produce a non-canonical layout diagnostic.

`computeAssignedBlockWidth` accepts a container width rather than assuming the
global page width. This allows the same function to work inside Callouts, List
items, and Table cells later.

## Visual dimensions

Image and Chart payloads carry `VisualDimensions` now:

```ts
interface VisualDimensions {
  widthTwips?: number;      // omit to use the assigned Block width
  heightTwips: number;
  lockAspectRatio: boolean;
  horizontalAlign: "left" | "center" | "right" | "stretch";
}
```

These dimensions are authored content, not pagination output. They are needed
for deterministic export and future Row-height calculation even before exact
page fragmentation exists.

## Future page breaks

Page breaks are not part of representation version 1. When added, they should
be explicit canonical intent rather than an inferred empty Row.

Two plausible future forms remain open:

```ts
// Option A: structural Block in a one-Block Row
interface PageBreakBlock extends BlockBase {
  kind: "page-break";
}

// Option B: Row boundary property
interface RowLayout {
  pageBreakBefore?: boolean;
  // existing fields...
}
```

The Block form makes a break visible and addressable in the editor. The Row
property makes it a flow rule attached to content. The choice should be made
when the paginator and editor interaction are designed together. Empty Rows
will not stand in for page breaks because every Row must contain a Block.

## Future pagination projection

When exact pagination is implemented, it belongs in a rebuildable projection
or renderer:

```ts
interface PaginationInput {
  snapshot: DocumentSnapshot;
  rendererVersion: string;
  fontManifestDigest: string;
}

interface PaginationProjection {
  documentRevision: number;
  semanticDigest: string;
  rendererVersion: string;
  fontManifestDigest: string;
  pages: PageFragment[];
}
```

Its cache key must include Document semantic digest, renderer version, and
exact font manifest. Deleting the projection changes performance only. It must
never be required to reconstruct Document content or history.

## Relationship to frontend and export

The frontend initially renders continuous Row flow constrained by the canonical
page width and margins. It may show page-shaped visual guides, but those guides
are presentation rather than canonical page boundaries.

Export can consume the same snapshot and page-layout intent. Until an exact
shared renderer exists, different renderers may paginate differently. That is
an acknowledged boundary, not hidden behind an approximate backend page count.
