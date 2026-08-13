# Document Runtime Procedures

The interface below is declared in `runtime-objects/document/definition.ts`,
where each method is a thin delegation. Every one of the twenty-two gets a
`runtime-api/<method>/` directory named after it in kebab-case, holding an entry
file of the same name that owns that method's complete orchestration — and each
procedure tree in this document becomes that directory's method document. The
mapping from method to directory, and the supporting procedures each one is
expected to need, are in [the implementation plan](implementation-plan.md).

## Runtime API

```ts
export interface DocumentRuntime {
  // Document and projection
  create(input: CreateDocumentInput): Promise<CreateDocumentResult>;
  display(documentId: DocumentId): Promise<DisplayDocument>;
  rename(input: RenameDocumentInput): Promise<DocumentMutationResult>;
  updatePage(input: UpdateDocumentPageInput): Promise<DocumentMutationResult>;
  delete(input: DeleteDocumentInput): Promise<void>;

  // Document Style Library and Block application
  createLibraryStyle(input: CreateLibraryStyleInput): Promise<LibraryStyleMutationResult>;
  updateLibraryStyle(input: UpdateLibraryStyleInput): Promise<DocumentMutationResult>;
  deleteLibraryStyle(input: DeleteLibraryStyleInput): Promise<DocumentMutationResult>;
  setBlockStyleApplications(
    input: SetBlockStyleApplicationsInput
  ): Promise<DocumentMutationResult>;

  // Rows and Blocks
  insertTextRows(input: InsertDocumentTextRowsInput): Promise<InsertRowsResult>;
  insertHorizontalRuleRow(input: InsertHorizontalRuleRowInput): Promise<InsertRowsResult>;
  insertPageBreakRow(input: InsertPageBreakRowInput): Promise<InsertRowsResult>;
  moveRow(input: MoveDocumentRowInput): Promise<DocumentMutationResult>;
  deleteRows(input: DeleteDocumentRowsInput): Promise<DocumentMutationResult>;
  insertBlock(input: InsertDocumentBlockInput): Promise<DocumentBlockMutationResult>;
  moveBlock(input: MoveDocumentBlockInput): Promise<DocumentMutationResult>;
  deleteBlocks(input: DeleteDocumentBlocksInput): Promise<DocumentMutationResult>;
  setRowWidths(input: SetDocumentRowWidthsInput): Promise<DocumentMutationResult>;

  // Owned Rich Content
  mutateContent(input: DocumentContentMutationInput): Promise<DocumentContentMutationResult>;
  splitBlockIntoRows(input: SplitDocumentBlockInput): Promise<SplitDocumentBlockResult>;
  separateBlockLines(input: SeparateDocumentBlockLinesInput): Promise<InsertRowsResult>;
  combineRowsAsList(
    input: CombineDocumentRowsAsListInput
  ): Promise<DocumentBlockMutationResult>;
}
```

The methods are grouped by responsibility even though one class implements them
all. They reach a caller over HTTP through the two endpoints in
[Endpoints](endpoints.md): the command union has one arm per mutator, and the
query union exposes `display` alone.

## Revision Inputs

Every structural mutator carries:

```ts
interface DocumentRevisionInput {
  readonly documentId: DocumentId;
  readonly expectedDocumentVersion: number;
}
```

Every operation that destroys or replaces Rich Content also carries:

```ts
interface DocumentBlockContentRevision {
  readonly blockId: DocumentBlockId;
  readonly expectedContentVersion: number;
}
```

Document resolves `contentId` from Block ownership. Callers never supply an
arbitrary content ID to an owned-content procedure.

## Placements

```ts
export type DocumentRowPlacement =
  | { readonly kind: "start" }
  | { readonly kind: "end" }
  | { readonly kind: "after"; readonly rowId: DocumentRowId };

export type DocumentBlockPlacement =
  | { readonly kind: "start"; readonly rowId: DocumentRowId }
  | { readonly kind: "end"; readonly rowId: DocumentRowId }
  | {
      readonly kind: "after";
      readonly rowId: DocumentRowId;
      readonly blockId: DocumentBlockId;
    };
```

Placements reference identities in the expected Document revision. Numeric
array offsets are not admitted.

## Line Separation Mode

```ts
export type DocumentLineBreakMode =
  | "separate-rows"
  | "preserve-rich-content";
```

The caller selects the mode explicitly:

- `separate-rows` creates one Rich Content Row per logical line, including an
  empty Rich Content Block for an empty line;
- `preserve-rich-content` creates one Rich Content Block retaining its internal
  `LineBreakAtom`s.

Ordinary editor insertion should select `separate-rows`. Lists and explicitly
multiline content select `preserve-rich-content`.

## Create Document

```ts
export interface CreateDocumentInput {
  readonly title: string;
  readonly page: DocumentPageSettings;
  readonly styleLibrary?: DocumentStyleLibrary;
  readonly initialText: string;
  readonly lineBreakMode: DocumentLineBreakMode;
  readonly initialRichContentStyle: RichContentStyleApplication;
  readonly initialDocumentStyle: DocumentBlockStyleApplication;
}
```

Creation requires current page settings and complete initial Block style
resolution. It does not install a hidden default.

```text
create(input)
  1. Validate title, mutable page settings, and optional Style Library.
  2. Resolve initial Rich Content and Document Block style applications.
  3. Generate Document, Row, Block, and required library IDs.
  4. Begin a shared database transaction.
  5. Insert the version-1 Document and Style Library.
  || lineBreakMode = separate-rows
     5.a.1. Split initialText at newline characters.
     5.a.2. Create one Rich Content object and full-width Row per logical line.
             Empty strings remain empty editable Rich Content objects.
  || lineBreakMode = preserve-rich-content
     5.b.1. Create one Rich Content object from all initialText.
     5.b.2. Create one full-width Rich Content Row.
  6. Commit Document structure and Rich Content together.
  7. Return Document ID, version, and created ownership identities.
```

## Display Document

```text
display(documentId)
  1. Begin a repeatable-read transaction.
  2. Load current page settings, Style Library, Rows, Blocks, and Row tracks.
  || Document does not exist
     2.a.1. Throw document-not-found.
  3. For each Rich Content Block:
     3.1. Resolve its Rich Content library entry and ad hoc properties.
     3.2. Resolve its Document Block library entry and ad hoc properties.
     3.3. Render Rich Content with the resolved Block-wide base characteristics.
     3.4. Derive font-size-based character width, height, character capacity,
          line capacity, wrapped height, alignment, and line spacing.
  4. Resolve Horizontal Rule presentation.
  5. Place Rows into estimated pages, honoring Page Break Blocks.
  6. Return DisplayDocument.
```

One snapshot prevents structural ownership from changing while Rich Content is
rendered.

## Rename and Update Page

`rename` validates the new title. `updatePage` accepts a complete current
`DocumentPageSettings` value, validates usable page geometry, CAS-commits the
Document, and causes the next display projection to recompute all capacities.

Neither procedure changes Rich Content revisions.

## Style Library Procedures

`createLibraryStyle`, `updateLibraryStyle`, and `deleteLibraryStyle` carry a
family discriminant:

```ts
export type DocumentStyleFamily = "rich-content" | "document-block";
```

They validate only same-family inheritance and advance the Document revision.
`setBlockStyleApplications` independently replaces either Block application
after resolving all required font-size, line-spacing, and alignment properties.
See [Document Style Library](styles.md).

## Insert Text Rows

```text
insertTextRows(documentId, expectedVersion, placement, text, mode,
               richContentStyle, documentStyle)
  1. Begin a shared transaction and load the expected structure.
  2. Resolve placement and both Block style applications.
  3. Translate text using the explicitly selected line-break mode.
  4. Ask Rich Content to create every required content object.
  5. Insert full-width Rows and Blocks.
  6. CAS Document and persist dense Row ordinals.
  || CAS fails
     6.a.1. Roll back all Rows, Blocks, and Rich Content objects.
  7. Return created identities and the new Document version.
```

## Insert Horizontal Rule Row

```text
insertHorizontalRuleRow(documentId, expectedVersion, placement, presentation)
  1. Validate thickness, insets, and color.
  2. Generate one Row ID and Horizontal Rule Block ID.
  3. Insert a dedicated full-width Row at placement.
  4. CAS Document and rewrite Row ordinals.
```

No Rich Content object or Style application is created.

## Insert Page Break Row

```text
insertPageBreakRow(documentId, expectedVersion, placement)
  1. Generate one Row ID and Page Break Block ID.
  2. Insert a dedicated full-width Row at placement.
  3. CAS Document and rewrite Row ordinals.
```

The display projection starts the following Row on a new page.

## Move and Delete Rows

`moveRow` preserves the Row, Block, style application, and Rich Content
identities while changing only Row order.

`deleteRows` requires the expected content revision of every selected Rich
Content Block:

```text
deleteRows(documentId, expectedDocumentVersion, rowIds, contentRevisions)
  1. Begin a shared transaction and load the expected Document.
  2. Require unique selected Rows owned by the Document.
  3. Verify an expected revision for every selected Rich Content Block.
  4. Delete selected Rows and Blocks, releasing content references.
  5. Destroy those exact Rich Content revisions.
  6. CAS Document and rewrite remaining Row ordinals.
  || any revision is stale
     6.a.1. Roll back all structural and content deletion.
```

Deleting every Row is valid.

## Insert, Move, and Delete Blocks

`insertBlock` inserts a Rich Content Block into an existing content Row,
creates its content, and normalizes destination widths in one transaction. It
rejects Horizontal Rule and Page Break Rows.

`moveBlock` reorders or moves a Rich Content Block among content Rows. If its
source becomes empty, that source Row is deleted. Source and destination width
sets are normalized.

`deleteBlocks` destroys selected owned Rich Content objects and removes an
empty Row. It requires every expected content revision.

Structural Blocks are managed through Row APIs because they must remain the
sole full-width Block in their Row.

## Set Row Widths

```text
setRowWidths(documentId, expectedVersion, rowId, completeWeightSet)
  1. Require a Rich Content Row.
  2. Require exactly one positive finite weight for every Block.
  3. Normalize deterministically to FULL_ROW_WIDTH_UNITS.
  4. CAS Document and persist the complete Row-owned track set.
```

Partial width updates are rejected.

## Mutate Owned Rich Content

```ts
export type DocumentContentMutation =
  | { readonly kind: "replace-text"; readonly input: ReplaceTextWithoutContentId }
  | { readonly kind: "apply-style"; readonly input: ApplyStyleWithoutContentId }
  | { readonly kind: "remove-style"; readonly input: RemoveStyleWithoutContentId }
  | { readonly kind: "set-link"; readonly input: SetLinkWithoutContentId }
  | { readonly kind: "remove-link"; readonly input: RemoveLinkWithoutContentId }
  | { readonly kind: "set-list"; readonly input: SetListWithoutContentId }
  | { readonly kind: "remove-list"; readonly input: RemoveListWithoutContentId };
```

```text
mutateContent(documentId, blockId, expectedContentVersion, mutation)
  1. Begin a shared transaction.
  2. Require a Rich Content Block owned by the Document.
  3. Resolve contentId from Block ownership.
  4. Reject inline line-height because Document owns relational line spacing.
  5. Ask Rich Content to validate and CAS-apply the mutation.
  6. Return unchanged Document version and new Rich Content version.
```

`replace-text` still rejects newline insertion. Enter uses
`splitBlockIntoRows`; multiline paste uses `insertTextRows` or an explicit
preserve-then-separate flow.

## Split Block Into Rows

This is normal Enter-key behavior. The first increment requires the source Row
to contain only the selected Block.

```text
splitBlockIntoRows(documentId, expectedDocumentVersion, blockId,
                   expectedContentVersion, displayPosition)
  1. Begin a shared transaction.
  2. Require a single-Block Rich Content Row.
  3. Delete the source ownership chain.
  4. Ask Rich Content to consume the source and create left and right objects.
  5. Create two new full-width Rows and Blocks at the source position.
  6. Copy both source style applications onto each new Block.
  7. CAS Document and rewrite Row ordinals.
  || either expected revision is stale
     7.a.1. Roll back the entire operation.
  8. Return the new Document version and both new ownership chains.
```

The source Row, Block, and content IDs are destroyed. Either result may be an
empty editable Rich Content Block.

## Separate Existing Rich Content Lines

`separateBlockLines` converts explicitly multiline Rich Content into ordinary
Rows and requires a single-Block source Row.

```text
separateBlockLines(documentId, expectedDocumentVersion, blockId,
                   expectedContentVersion)
  1. Begin a shared transaction and release source ownership.
  2. Ask Rich Content to partition at every LineBreakAtom.
  3. Create one full-width Rich Content Row for every partition, including
     empty content objects for empty logical lines.
  4. Preserve applicable inline styles and links in every partition.
  5. Drop list membership because the resulting Rows are ungrouped.
  6. Copy both source style applications to every replacement Block.
  7. CAS Document and atomically replace the source chain.
```

Document does not inspect raw atoms.

## Combine Rows as a List

Lists intentionally keep multiple lines in one Rich Content object.

```text
combineRowsAsList(documentId, expectedDocumentVersion,
                  selectedRows, contentRevisions, presentation)
  1. Begin a shared transaction.
  2. Require unique consecutive Rows in Document order.
  3. Require exactly one Rich Content Block per Row.
  4. Require identical Rich Content and Document Block style applications on
     every source so grouping loses no Block-level meaning.
  5. Verify every expected content revision.
  6. Delete the selected ownership chains.
  7. Ask Rich Content to combine source objects in Row order as one list.
     || any source contains multiple logical lines
        7.a.1. Reject; separate it first.
  8. Create one full-width replacement Row and Block.
  9. Copy the shared style applications.
  10. CAS Document and rewrite Row ordinals.
  || any revision is stale
     10.a.1. Roll back everything.
  11. Return the replacement chain and new Document version.
```

Inline styles and links survive because Rich Content copies atoms and marks,
not flattened display strings.

## Delete Document

Deletion is permanent in the first increment:

```text
delete(documentId, expectedDocumentVersion, contentRevisions)
  1. Begin a shared transaction.
  2. Load the expected Document and every owned Rich Content Block.
  3. Verify one expected content revision per owned object.
  4. Delete the Document at expectedDocumentVersion.
     4.1. Cascades release all Row and Block references.
  5. Destroy every exact Rich Content revision.
  || any revision is stale
     5.a.1. Roll back the complete deletion.
  6. Commit.
```

## Errors

The error class and this code union live in `errors.ts` at the capability root
rather than in `types/`, because a consumer catching an error is using the public
contract.

```ts
export type DocumentErrorCode =
  | "document-not-found"
  | "row-not-found"
  | "block-not-found"
  | "library-style-not-found"
  | "stale-document-version"
  | "invalid-title"
  | "invalid-page-settings"
  | "invalid-row"
  | "invalid-placement"
  | "invalid-widths"
  | "invalid-block-selection"
  | "invalid-style-library"
  | "invalid-style-application"
  | "style-in-use"
  | "content-ownership-conflict";
```

Rich Content validation and stale-version errors remain Rich Content errors;
Document does not rename them.

