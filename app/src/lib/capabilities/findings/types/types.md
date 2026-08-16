# Findings Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`finding.ts`](finding.ts) | `findingSourceValidator`, `FindingSource`, `Finding`, `FindingSummary`, `FindingDraft`, `findingTitle`, `findingSources` |

## The source validator is the model

`schema.ts` imports it and so does the deployment door, which makes the column's
five variants and the door's refusal of a sixth the same statement.

A `resource` source's `resourceType` is the general-resource union itself, taken
from [`revisions`](../../revisions/types/change.ts) rather than restated — a
fourth copy of "document, slides, spreadsheet" is a fourth thing to forget when a
resource kind is added. `resourceId` stays `v.string()` because three tables
answer to it and a union of id types would make every reader choose between them
to render one citation.

A `message` source names both tables outright — `researchThreads` and `messages`
— because both exist and a promoted turn is one turn in one thread. It is the
`resource` variant's opposite for the reason above: there is nothing to choose
between.

## `findingSources` states the rule the schema cannot

`v.optional(v.string())` says an excerpt may be absent. What it cannot say is
that a citation must point at *something* — a manual source whose note is blank,
or a url source with no address — or that `capturedAt` has to be a real moment.

**It also states what must not happen.** The excerpt and a page's title are
copies, so nothing here touches them; only the note and the address, which the
author typed, are trimmed. Normalizing a copy makes it a copy of something nobody
saw, which is the one thing the field exists to prevent.

## `FindingSummary` is what a list gets

It drops `body` and `sources` and keeps `sourceCount`. The row is read whole
either way — Convex has no column projection — so what it saves is the wire and
the client's parse, which is where a writeup holding a table and an image
actually costs something.

`Finding` is not the row either: it carries `id`, drops `projectId`, and keeps
`revision`, because a client cannot send back a revision it was never given.
