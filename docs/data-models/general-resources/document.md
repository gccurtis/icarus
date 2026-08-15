# Document

Prose. A title and an ordered list of content blocks.

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
type DocumentBody = ContentBlock[];
```

A document is the simplest possible consumer of [content
blocks](../content/content-block.md): a flat sequence, rendered in order.

## The body is not on this row

`blocks` lives in the [leader snapshot](../revisions/resource-snapshot.md), and
the current body is that snapshot plus the [change
sets](../revisions/change-set.md) after it. There is no `revision` field here
either — current revision is the highest change set revision, read from an
index.

Both absences are the same decision. A Convex patch rewrites the whole document,
so a body on this row would be rewritten in full on every edit, and a revision
counter on this row would force that rewrite even for a one-character change.
Keeping both off means an edit appends one small row and touches nothing else.

What remains here is what a document list, a tab, and a search result need —
readable without touching the body at all.

## No rows, no sections, no page model

The previous model set gave documents rows, each row holding block placements
with their own layout. Nothing needed it. A document is a single column of
content; multi-column layout is what [slides](slides.md) are for, and tabular
layout is what [spreadsheets](spreadsheet.md) are for.

Structure within a document comes from the blocks themselves — heading variants
with a `level`, list indentation — not from a container hierarchy. An outline is
derived by walking the blocks for headings, which is also how every consumer
already has to find them.

Pagination is a rendering concern. Where a page breaks depends on the viewport,
the font, and whether it is being printed, so it cannot be state.

## Title

Separate from the blocks rather than being the first heading block. A document
list, a tab, a search result, and a link all want the title without loading or
parsing the body, and a document with an empty body still has a name.

## Template origin

`templateId` records what a document was created from, if anything. It is
provenance only — the document is a full copy from the moment it is created, and
changing the [template](../special-resources/template.md) later does not change
documents already made from it. Retroactive template updates would mean either
storing a diff against the template forever or silently overwriting someone's
edits.

## Size

The 1 MiB limit applies to the snapshot holding the body, not to this row. That
is a large amount of prose and nothing is split preemptively; if real documents
start approaching it, the snapshot body is what gets chunked — see
[conventions](../README.md#document-size).

## Related

[content block](../content/content-block.md) ·
[resource snapshot](../revisions/resource-snapshot.md) ·
[change set](../revisions/change-set.md) ·
[template](../special-resources/template.md) ·
[comment](../collaboration/comment.md)
