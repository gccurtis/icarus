# Document capability — summary

## What we are building

Document is an editable, long-form, content-first Resource. Its canonical
state is not a set of pages. It is a globally styled, ordered flow of Rows.
Each Row contains one or more Blocks with relative width proportions. The
backend stores that content flow, one global page-layout definition, styles,
history, and the operational records needed to update generated content.

```text
canonical Document
  ├─ title and lifecycle
  ├─ global page-layout metadata
  ├─ semantic style registry
  └─ ordered body Rows
       └─ sibling Blocks with width proportions
            ├─ rich text
            ├─ lists and tables
            ├─ media / charts / embeds
            ├─ prompt text and provenance
            └─ Formula atoms with evaluated display text
```

This is intentionally one document flow, not an ordered sequence of Sections.
The Document defines one page size, margin set, and page-numbering policy for
the whole Document. If a future product needs a mid-document switch to different
geometry, it can introduce a separate feature; that is not part of this model.

Rows are the horizontal layout primitive. Their array order defines body flow;
within one Row, the layout gives each sibling Block a positive width proportion.
Page layout and margins determine the available Row width. Most Rows will
contain one full-width Block. Blocks have no canvas frames or independent page
coordinates. A Block controls text alignment and wrapping within its assigned
width, but cannot be freely positioned.

## Project-scoped runtime

Like Knowledge, Document is constructed with a store already scoped to one
project. Project and user IDs are not domain fields, ChangeSet fields, or
method parameters.

```ts
const store = resolveDocumentStore(projectId, db);
const documents = createDocumentCapability(
  store,
  { knowledge, intelligence, formula, logger },
  options,
);
```

Formula owns Name Manager integration and name recognition. Document has no
Formula resolver or Context reader dependency. It passes formula source to
`formula`, and passes the Prompt Block's `DocumentContext[]` directly to
`knowledge`.

The request/runtime layer resolves the project before it calls this object. The
Document capability sees only document IDs and values that belong to its scoped
store. SQLite table names or a database namespace are derived safely from the
project ID inside `resolveDocumentStore`; they are never passed through Document
operations.

## Design decisions

1. `DocumentSnapshot` owns one `pageLayout`, one style registry, and
   `rows: DocumentRow[]` in canonical vertical order.
2. Pages are not backend entities and have no canonical IDs. The backend stores
   only the global page-layout metadata that belongs to Document content.
3. Rows and Blocks have stable IDs. A Row owns sibling Block width proportions;
   Blocks are a closed discriminated union with typed list/table children. A
   generic `data: unknown` field is not allowed. There is no Metric Block.
4. Arrays define vertical and horizontal order. Insert/move commands use stable
   neighboring IDs; fractional rank strings are not needed.
5. A page layout is global. It and its margins determine Row width. Styles can
   be applied to a Block or a selected text range. Blocks control their own
   breaks, wrapping, and text alignment; nothing creates block-frame positioning.
6. Multiple writers can edit collaboratively in real time. An expected revision
   identifies the client snapshot. If retained intervening ChangeSets do not
   conflict with the submitted operations, Document semantically rebases and
   accepts the edit at the current head; otherwise it returns `revision_conflict`.
7. A materialized Base plus append-only ChangeSets is the revision model. Base
   compaction changes storage shape, never logical revision or accepted content.
   Each accepted Document change is reversible and contributes to the future
   cross-resource Activity timeline, which owns user-facing undo and redo.
8. Prompt Blocks retain editable canonical text alongside their instruction and
   `{ id, kind }` context list. Refresh takes that current text as
   stabilization input, passes the context list to Knowledge, and lets the
   reasoning model make stable, grounding-directed updates through its explicit
   refresh prompts.
9. The public backend surface has one serial `documents.command.v1` endpoint
   for all mutations and deferred-work requests, and one concurrent
   `documents.query.v1` endpoint for bounded reads. Their discriminated unions
   retain typed command/query results.
10. Creation and duplication are commands rather than reducer operations, but
   successful creation is still a first-class Activity operation. Every
   accepted canonical mutation contributes to Activity.
11. Every public call and internal stage is structured-logged through
   `dependencies.logger`; Activity remains the semantic resource history, while
   logs also cover reads, retries, rejections, and failures.
12. Formula atoms are evaluated through the injected `Formula` capability.
   Formula owns Name Manager access and name recognition. An accepted evaluation
   supplies the atom's display text, and marks/styles may address any range of
   that text.
13. Collaboration comments begin as text ranges. Added text within the range
   expands it; deleting or splitting selected text promotes it to a Document
   anchor. Block IDs remain implementation details.

## Canonical and operational backend state

| Canonical Document state | Rebuildable index / operational state |
| --- | --- |
| title, lifecycle, revision | workspace summary and word count |
| page layout, Rows, and Blocks | outline and searchable text |
| styles, table/list children | resolved styles, outline, search text |
| prompt definitions, accepted lattice grounding, and provenance | refresh status |
| Formula expressions, accepted values, and display text | Formula dependency index |
| Base and ChangeSets | scheduled compaction |
| refresh attempts and their durable results | scheduled jobs and temporary provider state |
| Activity contributions for accepted mutations | structured logs for every call and outcome |

Refresh attempts are durable operational records, but they are not part of the
Document snapshot. Only an accepted refresh ChangeSet modifies canonical
Document content.

## Files to read next

Read [canonical model](canonical-model.md) to assess whether the document's
content and layout shape feels right. Read [store and history](store-and-history.md)
to assess the scoped runtime and revision model. Read
[operations and endpoints](operations-and-endpoints.md) to assess the client
and backend surface. [Prompt refresh](prompt-refresh.md) contains Context-scoped
lattice grounding, structured reasoning calls, prompts, schemas, and settlement.
[Formula items](formula-items.md) defines the Formula-atom seam.
[File architecture](file-architecture.md) maps the design to implementation
files, functions, ports, and jobs. The cross-capability work required for
context-aware lattice descent is isolated in the
[Knowledge Context-scoping TODO](../knowledge-context-scoping-todo.md).

## Initial implementation defaults

- A stale submission is independent when none of the stable IDs touched by its
  operations were touched by intervening ChangeSets. The touched set includes
  direct mutation targets, structural anchors, and parent IDs only when the
  operation changes that parent's child membership, order, or layout. Any
  intersection returns `revision_conflict`; otherwise the operations apply
  unchanged at the current head.
- Each Document retains 5 Bases and 1,000 ChangeSets by default. Both counts are
  runtime configuration values and can be changed without altering the domain
  model.
