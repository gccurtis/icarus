# Icarus data models

What Icarus stores, one file per object.

These describe **state**, not behaviour. There are no interfaces, no method
signatures, no service boundaries here. Once the state is right, any capability
that reads or mutates it can be built on top; the reverse is not true, so the
state is what we settle first.

Procedures live in [docs/processes/](../processes/) instead — algorithms, phases,
and configuration that has no table. The [lattice](knowledge/knowledge-lattice.md)
leans on that split hardest: its fields are thin because nearly all of its meaning
is in how they are produced and walked.

## How to read a file

Each file is one object: a TypeScript interface showing the real fields, then
prose explaining what each group of fields is for and why it exists. Sub-types
appear only where a field genuinely has variants.

The TypeScript is a description, not a package. Nothing here compiles or ships.
When these become Convex tables the validators will be written from them, but
the file is the thinking, not the artifact.

## Conventions

**Convex gives every document `_id` and `_creationTime`.** Neither is repeated in
any interface below. `_id` has type `Id<"tableName">` and `_creationTime` is a
millisecond timestamp. Where a doc needs a *modified* time it declares
`updatedAt: number` explicitly, because Convex does not maintain one.

**Timestamps are `number`** — milliseconds since epoch, matching
`_creationTime`. Never a string.

**References are Convex ids** — `Id<"questions">`, `Id<"externalFiles">`. There
is no separate reference wrapper, no live-versus-pinned distinction, no revision
pinning. If a thing needs to remember what a reference *said* at a point in
time, it copies the text it needs.

**`projectId: Id<"projects">` on everything project-scoped.** The project is the
isolation boundary. Every query filters by it and every table that holds project
content indexes on it.

**Attribution is an [`Actor`](core/actor.md), not a user id.** `createdBy`,
`updatedBy`, and `actor` fields take the shared union, because agents,
automations, and connectors author content too. The few fields that stay
`Id<"users">` express human responsibility rather than authorship — see [where
actor is not used](core/actor.md#where-actor-is-not-used).

**Configuration means [the YAML files](../../app/configuration/)**, not any
object here. Deployment variables standing in for a `.env`; nothing in this
directory describes them.

**Optional means optional.** A field that is sometimes absent is `field?:
type`, not `field: type | null`.

## What is deliberately absent

The previous model set carried a persistence layer inside the type definitions.
None of it survives here:

- **branded id types** — an id is a `string`, and Convex's `Id<T>` already
  carries the table
- **`schemaVersion`** — nothing upcasts a serialized shape at read time; a
  schema change is a migration
- **`revision` on general resources** — documents, decks, and workbooks carry no
  revision field. Their number lives on their [change
  sets](revisions/change-set.md) instead, so an edit never rewrites the body just
  to bump a counter. Other objects do carry one, for a different purpose —
  [above](#revision-on-directly-edited-objects)
- **`digest`** — nothing needs content hashes to decide whether a projection is
  current; `state` fields say so directly
- **ownership refs** — content blocks are embedded values in the object that
  owns them, so ownership is structural rather than declared
- **a model registry** — the schema is the registry

## Ids inside a resource

Everything addressable inside a general resource — rows, slides, elements,
blocks, atoms, marks — carries an id from **one flat space per resource**, unique
there and nowhere else. Two documents may reuse the same ids and it means
nothing.

These are not Convex ids. They are short strings the resource generates, so
duplicating a resource is a copy and no coordination is needed to mint one.

Flat rather than nested, so a block moved between rows keeps its identity —
scoping ids to a container would mean a move re-identifies the thing being moved,
which is the case ids exist to survive. See [content
block](content/content-block.md#one-id-space-per-resource).

## `revision` on directly edited objects

An object a person edits in a form over minutes carries `revision: number`,
incremented on every accepted write. The client sends the revision it read, and a
write against a stale one is rejected.

This is not the same problem Convex's transactions solve. Those prevent two
writes racing *inside* a mutation; this is a person who opened a form, went to
lunch, and saved over an edit made while they were out. The read happened in a
query minutes ago, so no transaction covers it.

Rejection is the whole mechanism — the client is told the object moved and
decides what to do. No merging, no field-level reconciliation. That is the
difference between these and [general
resources](revisions/README.md), where concurrent editing is the point and
merging is worth its machinery.

Append-only tables have no `revision` (`activity`, `changeSets`,
`latticeChanges`), and neither do derived ones (`latticeNodes`,
`resourceSnapshots`, `derivedOutputs`). Nothing edits them in place. Messages are
append-only for the same reason and are not a table at all — a thread holds
[its own turns](core/message.md).

## Document size

A Convex document caps at 1 MiB. A resource that embeds its whole body — a
document, a deck, a sheet — is subject to that. Ordinary content is nowhere
near it, so nothing is split preemptively. If a resource type starts to
approach the cap in practice, its body moves to a child table keyed by the
resource, and the resource keeps the metadata.

## Index

**core** — [project](core/project.md), [user](core/user.md),
[actor](core/actor.md), [message](core/message.md)

**content** — [content block](content/content-block.md)

**data** — [name manager](data/name-manager.md), [analysis](data/analysis.md),
[analytic system overview](data/analytic-system-overview.md),
[chart](data/chart.md), [chart system overview](data/chart-system-overview.md)

**general resources** — [document](general-resources/document.md),
[slides](general-resources/slides.md),
[spreadsheet](general-resources/spreadsheet.md),
[page setup](general-resources/page-setup.md),
[style set](general-resources/style-set.md)

**special resources** — [external file](special-resources/external-file.md),
[connector](special-resources/connector.md),
[template](special-resources/template.md),
[resource set](special-resources/resource-set.md)

**research** — [question](research/question.md),
[hypothesis](research/hypothesis.md), [finding](research/finding.md),
[research link](research/research-link.md), [research](research/research.md)

**knowledge** — [knowledge lattice](knowledge/knowledge-lattice.md),
[derived output](knowledge/derived-output.md)

**ai** — [agent task](ai/agent-task.md), [automation](ai/automation.md),
[persona](ai/persona.md), [persona chat](ai/persona-chat.md)

**collaboration** — [comment](collaboration/comment.md),
[activity](collaboration/activity.md)

**revisions** — [the scheme](revisions/README.md),
[change set](revisions/change-set.md),
[resource snapshot](revisions/resource-snapshot.md),
[lattice version](revisions/lattice-version.md),
[lattice change](revisions/lattice-change.md)

## Where this sits

These files say what a thing **is**. Two neighbours answer the other questions:

- [revisions/](revisions/) — how a thing **changes**: heads, change sets,
  rebasing, retention
- [docs/storage/](../storage/) — what **rows exist** in Convex: table names,
  indexes, and the queries that read and write them
- [docs/processes/](../processes/) — how things **work**: algorithms, phases, and
  the configuration that tunes them

The split matters because the first does not imply the third. `Document` here has
no `blocks` field and there is no table where a whole document sits; reading one
touches three tables. Storage is where that is spelled out.

## Configuration

Tuning numbers do not live here. Rebase windows, retention depth, change-set
flush thresholds, retrieval beam and budget, and model bindings are all in
[`app/configuration/`](../../app/configuration/) — they are values to tune
against real use, not decisions the model makes.
