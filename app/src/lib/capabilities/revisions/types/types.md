# Revisions Types

Lives at `types/types.md`.

`types/` holds the canonical model. This capability stores nothing **yet**, so
there are no row shapes here — only the vocabulary every edit is written in.

Written validator-first — `v.union(…)` then `Infer<typeof …>` — because the
validator is what Convex enforces at the door and the type is generated from it.

## Files

| File | Holds |
| --- | --- |
| [`op.ts`](op.ts) | `OpTarget`, the five op validators, and `Op` |
| [`resource.ts`](resource.ts) | `GeneralResourceType`, `GENERAL_RESOURCE_TYPES`, `ResourceKey` |

## The property everything else rests on

**Every op is closed under inversion.** `was` reverses a `set`, `wasAfter`
reverses a `move`, a `text` op swaps its two strings, and `insert` and `remove`
reverse each other — same `ids`, same `after`, same `values`, opposite name.

**`insert` carries `ids`, which stage 0's shape did not.** Without them a client
inverting an insert would have to read an id out of each opaque value, and the
whole reason a payload is opaque is that nothing on this side may assume a body
shape. The ids are stated twice on the wire — here and inside each value — and
that redundancy is what buys inversion without opening the envelope.

That is why the extra payloads are carried, and it is not an audit trail. It
means **inverting an op never requires reading the body it applies to**, so a
client can assemble an undo from what it already holds, without a round trip and
without resolving a path. An undo is an ordinary change set.

Consequently nothing here resolves a path. A path is `/`-delimited — a `#id`
segment resolves by search, a numeric segment indexes, anything else is a key —
and walking it is the server's job. Everything on this side carries envelopes.

## Where the validator and the type disagree

**One place**, and it is the same compromise
[`content`](../../content/types/value.ts) makes for the same reason.

An op payload is `v.any()`, because an op is generic over three body shapes and
there is no union to write for "whatever lives at that path". But `Infer` turns
`v.any()` into `any`, and `any` spreads — a buffer of ops would quietly lose type
safety everywhere one is touched.

| | Validator says | Type says |
| --- | --- | --- |
| `set.value`, `set.was` | `v.any()` | `unknown` |
| `insert.values`, `remove.values` | `v.array(v.any())` | `unknown[]` |

So the five arms are written twice — once as validators, once as `Op` — and that
duplication is the visible cost.

**Accepted cost:** a malformed *payload* is storable. Everything outside one —
the op name, the target, the path, the ordering fields — is still checked.

## `GeneralResourceType` is closed; `ResourceKind` is not

The two look alike and answer opposite questions.
[`ResourceKind`](../../shared/types/resource.ts) is an open string because
connectors and file types keep arriving, and it exports no list of members on
purpose. This one is closed, and exports one.

A general resource is something with a body, an op vocabulary and an editor, so
adding a fourth is substantial work rather than configuration. Closing it is what
lets a body type resolve from a resource type, lets `revisions.submit` narrow its
argument, and makes a missing arm fail to compile.

Every general resource type is also a resource kind. Most resource kinds —
`finding`, `connector`, `external` — are not general resources, because nothing
edits them through ops.

## What a target is for

`OpTarget` is not how an op is dispatched; the path is. It exists so the
[conflict ladder](../../../../../../docs/processes/change-conflicts.md) can
pre-filter cheaply: a row insert cannot collide with a mark edit, and knowing
that without resolving either path is what makes the cheap checks cheap.

`cell` takes no `insert` and no `move`. Setting `B7` is how a cell comes into
being and its address is its position, so there is no ordered list to move it
within. That is a fact about spreadsheet paths rather than a constraint a
validator can state, and the server enforces it.
