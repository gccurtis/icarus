# Document

A page. Not a block list that happens to be printable — a page, with paper
dimensions, margins, headers, footers, and named styles, that people write memos
in.

```ts
interface Document {
  projectId: Id<"projects">;
  title: string;
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
}

// the body, stored as a leader snapshot plus change sets
interface DocumentBody {
  page: PageSetup;
  styles: StyleSet;
  rows: DocumentRow[];
  header?: PageFurniture;
  footer?: PageFurniture;
}

type DocumentRow =
  | { id: string; kind: "blocks"; blocks: ContentBlock[]; proportions?: number[] }
  | { id: string; kind: "divider"; color?: string; width?: number; style?: "solid" | "dashed" | "dotted" }
  | { id: string; kind: "pageBreak" };

interface PageFurniture {
  rows: DocumentRow[];
  firstPageRows?: DocumentRow[];
  distanceFromEdge: number;            // points
  pageNumber?: {
    position: "start" | "center" | "end";
    format?: string;                   // "{n}", "Page {n} of {total}"
    startAt?: number;
    hideOnFirstPage?: boolean;
  };
}
```

## Ids

Rows and the blocks inside them carry ids from [one space per
document](../content/content-block.md#one-id-space-per-resource) — flat, so a
block dragged from one row to another keeps its identity.

That is what makes concurrent editing work at the granularity people expect:
inserting a row above yours does not move yours, so the two edits never contend.

## It should read as a page, not a grid

The model is rows and blocks and that is not hidden — it is what a document is.
But the editing experience should feel like typing on a page: pressing Enter
makes a new line, not a new object a person has to think about.

The structure surfaces where it is genuinely useful — splitting a line into
columns is two blocks in one row, and that is exactly what someone wants when
they put a title left and a date right. It should not surface anywhere else.

Reordering is a case in point. `insert`, `remove`, and `move` on `rows` exist in
the [op
vocabulary](../revisions/change-set.md#the-same-five-ops-serve-all-three-resources),
so swapping two rows
or two blocks is expressible. Not implementing those gestures initially costs
nothing and keeps the surface simple; the model does not have to change when they
arrive.

The rest is the client's problem, not this model's.

## Rows, not a flat block list

Pressing Enter makes a new row. A row is the horizontal unit of a document, and
it is a union because the things that occupy a full width are genuinely different
kinds of thing — content, a rule, a break.

A `blocks` row holds one block in the overwhelming case. It holds several when
content sits side by side, which is what `proportions` is for: a header row split
into a title on the left and a name and date on the right, or a table with
explanatory text beside it.

`proportions` is relative, not absolute — `[2, 1]` gives the first block
two-thirds of the text width. Absolute widths would break the moment the page
size or margins changed, and the whole point of the row is that it fills the
measure.

When absent, blocks share the width equally. When present it must have the same
length as `blocks`; a mismatch is a bug rather than a case to interpret.

## Divider is a row, not a block

This resolves a question left open in
[content blocks](../content/content-block.md): a horizontal rule was rejected as
a block because it holds no content, takes no marks, and cannot be searched or
referenced.

As a row it fits exactly. A rule is structural — it separates content rather than
being content — and structure is what rows express. It also cannot be placed
beside something else in a row, which is correct: a half-width rule next to a
paragraph is not a thing anyone wants.

## There is no empty row kind

An empty line is a `blocks` row holding one text block with no atoms. That is
already what pressing Enter twice produces, and it is already what the editor has
to handle, so a dedicated `empty` variant would be a second spelling of a state
that exists anyway.

It also stays useful: the "empty" block still carries a style and a format, so an
empty line between paragraphs has the right height and an empty line under a
heading inherits the heading's spacing.

## Page breaks are explicit only

`pageBreak` is a break someone asked for. Where a page *naturally* ends depends
on the paper, the margins, the fonts, and the renderer, so it is computed at
render time and never stored — a stored automatic break would be wrong the moment
anything above it changed.

## Header and footer

Both are `PageFurniture`, and both hold rows — so a header can be split into two
proportioned blocks the same way body content can, which is how a title on the
left and a date on the right is expressed without a bespoke header layout model.

`distanceFromEdge` positions them from the paper edge rather than from the text
area, because that is how they are actually specified and because they live
outside the [margins](page-setup.md#margins-are-the-content-boundary).

`firstPageRows` is the different-first-page case — a title page with no running
head, or a letterhead that appears once. Separate rows rather than a
suppress flag, because "different" is more common than "absent" and a flag cannot
express it.

`pageNumber` is a property of the furniture rather than a block inside it,
because the number is not content — it is generated per page, and a block that
rendered differently on every page would break the one-block-one-value rule the
whole content model rests on. `format` handles the "Page 3 of 12" case without a
second field.

## Styles

`styles` is the document's [style set](style-set.md) — named styles that blocks
reference. This is what makes a document feel like a document rather than a pile
of independently formatted paragraphs: applying "Body" makes a paragraph match
the others by definition, and editing "Heading 1" restyles every heading.

## The body is not on this row

`page`, `styles`, `rows`, and the furniture live in the [leader
snapshot](../revisions/resource-snapshot.md); the current body is that snapshot
plus the [change sets](../revisions/change-set.md) after it. There is no
`revision` field here either — current revision is the highest change set
revision, read from an index.

Both absences are the same decision. A Convex patch rewrites the whole document,
so a body on this row would be rewritten in full on every edit, and a revision
counter would force that rewrite even for a one-character change.

What remains here is what a document list, a tab, and a search result need —
readable without touching the body.

Page setup and styles being *in* the body rather than on the row is deliberate:
changing the margins or restyling headings is an edit, and edits are change sets.
An undo has to reach them.

## Title

Separate from the rows rather than being the first heading block. A document
list, a tab, a search result, and a link all want the title without loading or
parsing the body, and a document with an empty body still has a name.

## Template origin

`templateId` records what a document was created from, if anything. It is
provenance only — the document is a full copy from creation, and changing the
[template](../special-resources/template.md) later does not change documents
already made from it.

## Size

The 1 MiB limit applies to the snapshot holding the body. That is a large amount
of prose and nothing is split preemptively; if real documents approach it, the
snapshot body is what gets chunked — see
[conventions](../README.md#document-size).

## Related

[content block](../content/content-block.md) · [page setup](page-setup.md) ·
[style set](style-set.md) ·
[resource snapshot](../revisions/resource-snapshot.md) ·
[change set](../revisions/change-set.md) ·
[comment](../collaboration/comment.md)
