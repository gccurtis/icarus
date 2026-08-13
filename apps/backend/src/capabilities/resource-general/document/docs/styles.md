# Document Style Library

## Purpose

The Document Style Library stores reusable style groups. It is not the Style
state of a Block itself, and there is no privileged default Style.

The library has two independent families:

1. **Rich Content Styles** describe characteristics applied to all text in one
   Rich Content Block before inline marks.
2. **Document Block Styles** describe relational layout behavior scoped to one
   Block, beginning with line spacing and text alignment.

Each family can be applied from the library, ad hoc on a Block, or as a library
entry plus ad hoc overrides.

## Library Model

```ts
export interface DocumentStyleLibrary {
  readonly richContentStyles: readonly RichContentLibraryStyle[];
  readonly blockStyles: readonly DocumentBlockLibraryStyle[];
}

export interface RichContentLibraryStyle {
  readonly id: RichContentStyleId;
  readonly name: string;
  readonly basedOnStyleId?: RichContentStyleId;
  readonly properties: DocumentRichContentStyleProperties;
}

export interface DocumentBlockLibraryStyle {
  readonly id: DocumentBlockStyleId;
  readonly name: string;
  readonly basedOnStyleId?: DocumentBlockStyleId;
  readonly properties: Partial<DocumentBlockStyleProperties>;
}
```

The two ID domains and inheritance graphs cannot reference each other.

## Rich Content Style Characteristics

```ts
export type DocumentRichContentStyleProperties = Omit<
  StyleProperties,
  "lineHeight"
>;
```

This family includes properties such as:

- font family and font size;
- bold, italic, underline, strike, and code treatment;
- font weight;
- foreground and background color;
- letter spacing.

Line height is excluded because Document owns line spacing as relational Block
layout. The resolved font size is also the starting point for character-width
and character-height estimation.

## Document Block Style Characteristics

```ts
export type TextAlignment = "start" | "center" | "end" | "justify";

export interface DocumentBlockStyleProperties {
  readonly lineSpacing: number;
  readonly textAlignment: TextAlignment;
}
```

These properties describe the relation between rendered text and its Block
container. They do not become Rich Content marks.

The first increment starts with alignment and spacing. Future relational
properties—indentation, vertical spacing, keep-with-next, or vertical
alignment—belong here when their layout behavior is designed.

## Block Applications

```ts
export interface RichContentStyleApplication {
  readonly libraryStyleId?: RichContentStyleId;
  readonly properties: DocumentRichContentStyleProperties;
}

export interface DocumentBlockStyleApplication {
  readonly libraryStyleId?: DocumentBlockStyleId;
  readonly properties: Partial<DocumentBlockStyleProperties>;
}
```

The `properties` field is ad hoc Block state. It overlays the referenced library
entry when present. A Block may omit a library ID and use only ad hoc values.

Every Rich Content Block must resolve a finite positive font size, finite
positive line spacing, and known text alignment. This may come from library
inheritance, ad hoc properties, or both.

Creation can add conventional `Body Text` and `Body Layout` entries and assign
them to the initial Block, but these entries have no privileged semantics. They
can be edited, deleted when unused, or ignored in favor of ad hoc styling.

## Resolution Within Each Family

```text
resolveStyleApplication(library, application)
  1. Start with an empty property set.
  || application.libraryStyleId exists
     1.a.1. Resolve its inheritance chain from oldest ancestor to leaf.
     1.a.2. Overlay each library entry's properties.
  2. Overlay application.properties.
  3. Validate the resolved required properties.
  4. Return an immutable resolved value.
```

Library entries may be partial. The complete Block applications must resolve
all properties required for Document layout.

## Rich Content Rendering Cascade

For content characteristics, precedence is:

```text
1. Rich Content capability baseline
2. resolved Rich Content Style Library entry
3. ad hoc Rich Content properties on the Block
4. Rich Content inline Style Marks in mark order
```

This satisfies the requirement that Block-wide Rich Content characteristics
apply to all text before local inline styling. Document does not copy its base
properties into raw Rich Content marks.

For relational styling, precedence is separate:

```text
1. resolved Document Block Style Library entry
2. ad hoc Document Block properties
```

The result stays on `DisplayRichContentBlock` as line spacing and alignment.

## Required Rich Content Display Port

Rich Content should accept an externally resolved base without exposing raw
marks:

```ts
export interface RichContentDisplayOptions {
  readonly baseStyle?: DocumentRichContentStyleProperties;
}

display(
  id: RichContentId,
  options?: RichContentDisplayOptions
): Promise<DisplayContent>;
```

Its renderer overlays inline Style Marks after the supplied base. The shared
transaction participant supports the same option.

For Document-owned content, `mutateContent` rejects inline `lineHeight`
application. Document line spacing remains authoritative for layout.

## Library Procedures

Both families support parallel procedures:

```text
createLibraryStyle(documentId, expectedVersion, family, definition)
  1. Generate an ID in the selected family.
  2. Validate copied properties and optional same-family parent.
  3. Validate the complete family inheritance graph.
  4. CAS the Document revision and insert the entry.

updateLibraryStyle(documentId, expectedVersion, family, styleId, changes)
  1. Apply copied changes to the expected Document revision.
  2. Validate graph, property types, and all affected Block resolutions.
  3. CAS and persist the entry.

deleteLibraryStyle(documentId, expectedVersion, family, styleId)
  1. Reject an entry referenced by a Block.
  2. Reject an entry used as another library entry's parent.
  3. CAS and delete it.
```

Updating a library entry changes Display Document at the new Document revision
without rewriting Rich Content or advancing Rich Content revisions.

## Apply Style to Block

```text
setBlockStyleApplications(documentId, expectedVersion, blockId,
                          richContentStyle?, documentStyle?)
  1. Require a Rich Content Block.
  2. Resolve any library IDs within the correct family.
  3. Copy and validate ad hoc properties.
  4. Require complete font-size, line-spacing, and alignment resolution.
  5. CAS the Document revision and persist the applications.
```

Either application may be changed without replacing the other.

Horizontal Rule presentation is currently ad hoc on its Block. Page Break
Blocks have no style application.

## Inheritance Invariants

- Parents remain in the same Document and style family.
- No entry inherits from itself.
- Neither family graph contains a cycle.
- Inheritance depth is bounded.
- Names are non-empty but do not need to be unique.
- All numeric properties are finite and within their declared ranges.
- Deleting a referenced entry is rejected rather than silently rewriting
  Blocks or children.

