# Revisions

The edit vocabulary: five ops over a path, and the two types that say which
resource they are against.

## It ships before its tables, and that is the point

`changeSets` and `resourceSnapshots` are not here. Neither is an `api/`, a
`schema.ts`, or a file under `src/convex/capabilities/` — nothing in this
capability is callable yet.

**Everything that edits a body is written in these types**, so they are
foundation in the same sense [`content`](../content/overview.md) and
[`shared`](../shared/overview.md) are: a dozen things depend on the vocabulary
before anything depends on the tables. Shipping the types first is what lets the
client's [resource runtimes](../../model/client/resource-runtimes/resource-runtimes.md)
be built, tested and reviewed against the real `Op` rather than against a
placeholder that would have to be unwound.

[Stage 0](../../../../docs/stage-0/0-foundation-design.md#revisionstypes--the-edit-vocabulary)
designed this vocabulary in full and deferred it here. This is that design,
shipped, with two names settled on the way in:

| Stage 0 called it | Shipped as | Why |
| --- | --- | --- |
| `ResourceType` | `GeneralResourceType` | `ResourceKind` already exists over a wider, *open* space; two similar names over different spaces is how the open one gets closed by accident |
| — | `GENERAL_RESOURCE_TYPES` | The space is closed, so the list is the truth rather than a snapshot |

## The boundary

Revisions owns how a change is *expressed*. It owns nothing about how one is
stored, ordered, applied, or resolved against a conflict.

It deliberately does not own:

- **Bodies.** A `DocumentBody` belongs to `documents`, and this capability never
  refers to one. An op names a path into a body it cannot see.
- **Path resolution.** A path is a string here. Walking it belongs to whatever
  applies the change set.
- **Conflict policy.** `OpTarget` exists so the
  [ladder](../../../../docs/processes/change-conflicts.md) can pre-filter, but
  the ladder itself is a process, not a type.
- **Buffering, batching and retry.** Those are the client's, and they are the
  [resource runtimes](../../model/client/resource-runtimes/resource-runtimes.md).

## What arrives with the tables

`changeSets` and `resourceSnapshots`, their schema fragment, their `api/`, and a
registration file. When they do, this capability gains a `schema.ts` and a door
and stops being types-only — and nothing in `types/` has to change for it,
because the vocabulary was designed against those tables in the first place.

## Files

| File | Holds |
| --- | --- |
| [`types/types.md`](types/types.md) | the canonical model, and where the validator and the type disagree |
| [`types/op.ts`](types/op.ts) | `OpTarget`, the five op validators, `Op` |
| [`types/resource.ts`](types/resource.ts) | `GeneralResourceType`, `GENERAL_RESOURCE_TYPES`, `ResourceKey` |
