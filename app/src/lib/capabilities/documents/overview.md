# Documents

A document's name, its origin, and who touched it last. Not its content — that
is a different table and a different pass.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one project's documents |
| `create` | mutation | starts one, returning its id |
| `rename` | mutation | gives one a different name |
| `remove` | mutation | deletes one |

Registered in
[`src/convex/capabilities/documents.ts`](../../../convex/capabilities/documents.ts),
all four built from `projectQuery` / `projectMutation`.

There is no `read`. A document's body is read through `revisions` in pass 2, and
a reader that needs the metadata alone already has it from `list`.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `documents` | one row per document: title, template origin, attribution, and when it last changed |

## The body is somewhere else, and so is the revision

This is the decision the whole capability is shaped by, and it is
[storage/general-resources.md](../../../../../docs/storage/general-resources.md)'s
rather than ours.

**A Convex patch rewrites the whole document.** A body on this row would
therefore be rewritten in full on every accepted edit — hundreds of kilobytes for
one character — and a `revision` field would force that same rewrite merely to
bump a counter. With neither, an edit is one small insert into `changeSets` and
this row is not touched at all.

What is left is exactly what a list, a tab, a breadcrumb, and a search result
render from, readable without loading a word of content. That is why `list` stays
cheap however much has been written.

Pass 2 adds the leader snapshot and the change-set log, and `remove` takes a
document's snapshot and change sets with it.

`create` takes the body it starts from, which is the empty one for a document
someone starts and the template's own for one
[`templates.instantiate`](../templates/api/instantiate/instantiate.md) makes. The
body is stored unread either way — that is what makes a document from a template
a complete copy that owes it nothing, and `templateId` provenance and nothing
more.

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A document in another project
  answers exactly as one that never existed, because telling them apart confirms
  the document exists to someone with no right to know that.
- **Attribution is built from the scope**, never accepted as an argument. An
  argument naming the author would let a caller sign someone else's name to a
  document.
- **Every mutation records its activity in the same transaction.** An entry
  cannot be missing from a write that happened, and `remove` reads the title
  before deleting so the entry can still say what was deleted.
- **A title is trimmed and never empty.** A document is reached by name in every
  surface that lists one. What to call an unnamed document is the client's
  decision, not this capability's.
- **Both refusals are thrown as `DocumentsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal at all.

## Related

[document](../../../../../docs/data-models/general-resources/document.md) — the
model this implements ·
[general resources in Convex](../../../../../docs/storage/general-resources.md) —
why the row holds no body
