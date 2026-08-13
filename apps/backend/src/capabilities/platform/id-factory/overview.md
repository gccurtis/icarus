# ID Factory Overview

## Description

ID Factory is the Platform capability that generates identifier values. Its
whole interface is one method returning one collision-resistant string.

This capability is deliberately tiny and deliberately generic, and both are
design decisions rather than an unfinished state. It exists because ID
*generation* is infrastructure — a UUID source, one instance per runtime, one
place to change if the scheme ever changes — while ID *semantics* are not.

## Why the semantics stayed with the consumer

The obvious larger version of this capability owns the identifier vocabulary:
`contentId()`, `atomId()`, `documentId()`, `rowId()`. That version was
considered and rejected. It would make Platform the place where every
capability's identity kinds are enumerated, so adding a kind to Rich Content
would mean editing Platform, and Platform would accumulate knowledge of resource
concepts it has no other reason to know.

What is genuinely shared between capabilities is narrower than it first looks:
they all want a value nothing else will produce. Everything else differs.
Rich Content decides that a mark ID is private and never surfaces in
`DisplayContent`; Document decides that a row ID and a block ID are distinct
kinds; each decides *when* an ID is allocated — notably Rich Content's `split`
and `combineAsList`, which regenerate atom and mark IDs because their results
are new objects rather than edited ones. None of that is a property of the
generator.

So a consumer keeps its own factory as an internal runtime object with its own
named methods, and that factory delegates value generation here. Rich Content's
[`RichContentIdFactory`](../../resource-support/rich-content/runtime-objects/id-factory/id-factory.md)
is the first, and the design record for the second is the ID Factory section of
[`document/docs/implementation-plan.md`](../../resource-general/document/docs/implementation-plan.md).
The split is what lets both patterns hold at once: one generator, several
vocabularies.

The prefixes stay with the consumer for the same reason. `content_<uuid>` is
Rich Content's convention for making a stored JSONB row self-describing; a
generator that applied it would be deciding what the ID names.

## Boundary

ID Factory owns:

- The generation scheme — today `randomUUID()` — and the guarantee that two
  calls never return the same value.
- The single instance per backend runtime.

Consumers own:

- Their identifier kinds, their names, their branded types, and their prefixes.
- When an ID is allocated, and which entity it names.
- Their own semantic factory, if they want one. This capability does not
  require a consumer to have one; it requires nothing of consumers at all.

## File Tree

```text
id-factory/
├── overview.md
├── index.ts
├── runtime-objects/
└── runtime-api/
```

There is no `types/`: the interface returns `string`, and a branded ID type
would be exactly the semantics this capability declines to own. There is no
`errors.ts`, `persistence/`, or `endpoints/` — generation cannot fail, stores
nothing, and is reached through the runtime object rather than over HTTP. There
is no `test/`: a UUID wrapper has no behavior of its own to assert, and the
consumers that build IDs on it test the IDs they produce.

## Dependency Ports

ID Factory has no capability dependencies. It is constructed first and depends
on nothing that can fail, which is why every other capability may take one.

## Runtime Objects

One instance per backend runtime, constructed by
[`main.ts`](../../../main.ts) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `IdFactory` | yes | Returns one collision-resistant identifier value per call. | [id-factory.md](runtime-objects/id-factory/id-factory.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `create` | runtime method | `IdFactory` | Returns one identifier value. | [create.md](runtime-api/create/create.md) |

## Data Ownership

ID Factory stores nothing. It owns no table and holds no state between calls —
there is no counter, no reservation, and no high-water mark to persist, because
collision resistance comes from the value's width rather than from memory of
what was issued.

## Capability Invariants

- Every value returned is distinct from every value returned before it, in this
  runtime and in any other.
- The value carries no meaning: no kind, no prefix, no encoded time, no
  ordering. A consumer may not parse one.
- The object is stateless and safe to share. Every capability in a runtime may
  hold the same instance.
- Generation never fails and never blocks.
