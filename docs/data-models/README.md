# Icarus data models

What Icarus stores, one file per object.

These describe **state**, not behaviour. There are no interfaces, no method
signatures, no service boundaries here. Once the state is right, any capability
that reads or mutates it can be built on top; the reverse is not true, so the
state is what we settle first.

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
- **`revision` fields** — no object carries one. Convex mutations are
  transactional, so nothing needs a compare-and-swap value merely to avoid a
  lost update. General resources are revisioned, but the number lives on their
  [change sets](revisions/change-set.md) rather than on the resource row, so an
  edit never rewrites the body just to bump a counter
- **`digest`** — nothing needs content hashes to decide whether a projection is
  current; `state` fields say so directly
- **ownership refs** — content blocks are embedded values in the object that
  owns them, so ownership is structural rather than declared
- **a model registry** — the schema is the registry

## Addressing a content block

Blocks have no ids. A block is identified by the object that holds it, the field
it sits in, and its index: *this document, `blocks`, index 4*. Mutation is gated
by the owning object regardless, so an independent identity would only be a
second thing to keep in sync.

The cost is that a concurrent edit is resolved at the field level rather than the
block level. That is the right trade at this stage; if collaborative editing
later needs finer granularity, blocks gain stable keys then, on evidence.

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

**general resources** — [document](general-resources/document.md),
[slides](general-resources/slides.md),
[spreadsheet](general-resources/spreadsheet.md)

**special resources** — [external file](special-resources/external-file.md),
[connector](special-resources/connector.md),
[template](special-resources/template.md),
[resource set](special-resources/resource-set.md)

**research** — [question](research/question.md),
[hypothesis](research/hypothesis.md), [finding](research/finding.md),
[research](research/research.md)

**knowledge** — [knowledge lattice](knowledge/knowledge-lattice.md),
[derived output](knowledge/derived-output.md)

**ai** — [agent task](ai/agent-task.md), [automation](ai/automation.md),
[persona](ai/persona.md), [persona chat](ai/persona-chat.md),
[intelligence](ai/intelligence.md)

**collaboration** — [comment](collaboration/comment.md),
[activity](collaboration/activity.md)

**revisions** — [the scheme](revisions/README.md),
[change set](revisions/change-set.md),
[resource snapshot](revisions/resource-snapshot.md),
[lattice version](revisions/lattice-version.md),
[lattice change](revisions/lattice-change.md)

## Reference

The prior model set is preserved unchanged at
[docs/icarus-data-models/](../icarus-data-models/). It is not maintained and
nothing here is derived from it mechanically.
