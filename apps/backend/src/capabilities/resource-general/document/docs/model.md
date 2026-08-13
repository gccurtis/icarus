# Document Aggregate Model

## Canonical Aggregate

```ts
export type DocumentId = string;
export type DocumentRowId = string;
export type DocumentBlockId = string;
export type RichContentStyleId = string;
export type DocumentBlockStyleId = string;

export interface DocumentState {
  readonly id: DocumentId;
  readonly version: number;
  readonly title: string;
  readonly page: DocumentPageSettings;
  readonly styleLibrary: DocumentStyleLibrary;
  readonly rows: readonly DocumentRow[];
}

export interface DocumentRow {
  readonly id: DocumentRowId;
  readonly blocks: readonly DocumentBlock[];
  readonly layout: DocumentRowLayout;
}

export interface DocumentRowLayout {
  readonly tracks: readonly DocumentRowTrack[];
}

export interface DocumentRowTrack {
  readonly blockId: DocumentBlockId;
  readonly widthUnits: number;
}

export type DocumentBlock =
  | RichContentBlock
  | HorizontalRuleBlock
  | PageBreakBlock;
```

The aggregate is presented as one type for reasoning. Persistence may normalize
its parts into tables, but every successful mutation must leave the complete
aggregate valid.

## Mutable Page Settings

```ts
export interface DocumentMargins {
  readonly topPt: number;
  readonly rightPt: number;
  readonly bottomPt: number;
  readonly leftPt: number;
}

export interface DocumentPageSettings {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly margins: DocumentMargins;
}
```

Page settings are current authored state, not defaults. `updatePage` may change
any value through the normal Document revision gate. Points provide one stable
unit for page geometry: 72 points equal one inch.

Page validation requires finite positive dimensions, finite non-negative
margins, and positive usable width and height after margins.

Average character width and height are not persisted in page settings. They are
derived initially from each Rich Content Block's resolved font size as
described in [Layout](layout.md).

## Document Style Library

```ts
export interface DocumentStyleLibrary {
  readonly richContentStyles: readonly RichContentLibraryStyle[];
  readonly blockStyles: readonly DocumentBlockLibraryStyle[];
}
```

The two libraries are independent:

- Rich Content library entries group font, emphasis, color, and other
  characteristics applied across all text in one Block before inline marks.
- Document Block library entries group relational layout properties such as
  alignment and line spacing.

Blocks may reference either library, apply ad hoc properties, or combine a
library reference with ad hoc overrides. There is no canonical “default Style”
field. See [Document Style Library](styles.md).

## Rich Content Block

```ts
export interface RichContentBlock {
  readonly id: DocumentBlockId;
  readonly kind: "rich-content";
  readonly contentId: RichContentId;
  readonly richContentStyle: RichContentStyleApplication;
  readonly documentStyle: DocumentBlockStyleApplication;
}
```

A Rich Content Block exclusively owns one Rich Content object. Its two style
applications are independently scoped to that Block.

Text, line-break atoms, inline style marks, links, and list marks are not
embedded in the Block. They remain private to Rich Content.

An empty Rich Content object is a valid editable blank Block. It is how the
Document represents an empty authored line or paragraph.

## Horizontal Rule Block

```ts
export interface HorizontalRuleBlock {
  readonly id: DocumentBlockId;
  readonly kind: "horizontal-rule";
  readonly presentation: HorizontalRulePresentation;
}

export interface HorizontalRulePresentation {
  readonly thicknessPt: number;
  readonly color: string;
  readonly insetStartPt: number;
  readonly insetEndPt: number;
}
```

A Horizontal Rule Block renders a non-editable horizontal separator. It owns no
Rich Content and has no text Style application. The first increment requires
it to be the only Block in a full-width Row.

Its presentation is ad hoc state on the Block. A reusable horizontal-rule
library can be added later if repetition justifies it; it is not mixed into the
Rich Content or Document Block Style libraries prematurely.

## Page Break Block

```ts
export interface PageBreakBlock {
  readonly id: DocumentBlockId;
  readonly kind: "page-break";
}
```

A Page Break Block owns no Rich Content and must be the only Block in a
full-width Row. During layout, it ends the current page immediately. The next
Row begins at the next page's top content boundary. It renders only editor
chrome when formatting marks are visible; it contributes no printable content.

## Why There Is No Line-Break Block

Rich Content already owns line-break atoms. Document normally turns those
logical lines into separate Rich Content Rows. An empty logical line becomes an
empty Rich Content Block, retaining an editable caret target.

```text
"alpha\nbeta"
  Row(RichContentBlock("alpha"))
  Row(RichContentBlock("beta"))

"alpha\n\nbeta"
  Row(RichContentBlock("alpha"))
  Row(RichContentBlock(""))
  Row(RichContentBlock("beta"))
```

A Horizontal Rule is explicit authored structure, not a line break. A Page
Break controls pagination rather than text or blank-line content.

## Display Model

```ts
export interface DisplayDocument {
  readonly documentId: DocumentId;
  readonly version: number;
  readonly title: string;
  readonly page: DocumentPageSettings;
  readonly rows: readonly DisplayDocumentRow[];
}

export interface DisplayDocumentRow {
  readonly id: DocumentRowId;
  readonly pageIndex: number;
  readonly estimatedHeightPt: number;
  readonly blocks: readonly DisplayDocumentBlock[];
}

export type DisplayDocumentBlock =
  | DisplayRichContentBlock
  | DisplayHorizontalRuleBlock
  | DisplayPageBreakBlock;

export interface DisplayRichContentBlock {
  readonly id: DocumentBlockId;
  readonly kind: "rich-content";
  readonly widthProportion: number;
  readonly widthPt: number;
  readonly textAlignment: TextAlignment;
  readonly lineSpacing: number;
  readonly estimatedCharacterWidthPt: number;
  readonly estimatedCharacterHeightPt: number;
  readonly estimatedCharactersPerLine: number;
  readonly estimatedLinesPerPage: number;
  readonly content: DisplayContent;
}
```

The structural display variants include their width and presentation or page
break intent. `DisplayDocument` is derived and never stored.

## Identity and Ownership

- Document requests Document, Row, Block, and Style Library IDs from the
  centralized runtime `IdFactory`; Document owns their lifecycle and meaning.
- Rich Content requests content, atom, mark, and list IDs from the same
  generator; Rich Content owns their lifecycle and meaning.
- Moving or resizing a Row or Block preserves its ID.
- Ordinary Rich Content edits preserve the owning Block.
- Splitting a Block destroys the source Block and source content object, then
  creates new Rows, Blocks, and content objects.
- Combining Blocks destroys all selected Blocks and content objects, then
  creates one replacement ownership chain.
- Deleting a Rich Content Block also destroys its exclusively owned content in
  the same transaction.
- Horizontal Rule and Page Break Blocks own no capability-external state.

## Revision Domains

```text
Document version changes for:
  title, page settings, Style Library, Style applications,
  Rows, Blocks, widths, split/combine ownership

Rich Content version changes for:
  text, inline style marks, links, and list marks
```

An inline edit does not change the Document version. A page or layout edit does
not change unaffected Rich Content versions. Split, combine, and deletion check
and change both domains atomically.

## Aggregate Invariants

- IDs are unique within their ownership domain.
- Rows are ordered and non-empty.
- A content Row contains one or more Rich Content Blocks.
- A Horizontal Rule Row contains exactly one Horizontal Rule Block.
- A Page Break Row contains exactly one Page Break Block.
- Structural Blocks cannot coexist with Rich Content Blocks in one Row.
- Every Row layout has exactly one track for every Block and no extra tracks.
- Each Row's positive width units sum to the canonical full-row width.
- Every referenced library Style belongs to this Document and matches the
  application kind.
- Every Rich Content Block exclusively owns one existing Rich Content object.
- Formula and prompt variants cannot enter the model because they are absent
  from the closed Block and Rich Content atom unions.
