# Activity Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`activity.ts`](activity.ts) | `Activity`, `ActivityEntry`, and the `actorLabel` and reference validators |

## The validators live here, and `schema.ts` composes them

`actorLabel` and `target` are model shapes rather than storage decisions — the
same object is written, read, and rendered. Declaring them once and building the
table from them keeps one statement of one fact, the same reason
[`shared`](../../shared/types/types.md) infers `Actor` from its validator rather
than writing both.

What `schema.ts` adds on top is exactly the storage part: `projectId`, and the
index that leads with it.

## `Activity` is not the row

It carries no `projectId` and no id. Every entry a caller receives is from the
project they asked about, so repeating it per entry says nothing, and there is
nothing to fetch a single entry by — a log is read as a range, never by key.

## `ActivityEntry` states what happened, not when

`at` is absent from it because `record` stamps it. A caller cannot supply a
timestamp because there is no field to put one in.

`actorLabel` is optional for the opposite reason: `record` resolves the kinds it
can reach and ignores one passed for those, so the field exists only for an actor
whose table does not exist yet. It becomes unnecessary as passes 7 and 8 land.
