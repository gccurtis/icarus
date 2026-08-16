# Shared Types

Lives at `types/types.md`.

The whole of this capability. There is nothing to keep out of it — no stored row
shapes, because nothing here is a row: these are the fields other capabilities'
tables embed.

## Files

| File | Holds |
| --- | --- |
| [`actor.ts`](actor.ts) | `actorValidator`, and the `Actor` type inferred from it |
| [`page-setup.ts`](page-setup.ts) | `pageSetupValidator`, `paperSizeValidator` — paper, orientation, margins |
| [`style-set.ts`](style-set.ts) | `styleSetValidator`, `textStyleValidator` — a resource's named styles |

The validator is the source and the type is derived from it, not the other way
round. A hand-written `Actor` beside a hand-written validator is two statements
of one fact, and a table would eventually accept a shape the type forbids.

## Page setup and style sets sit here rather than in a resource

A document, a deck's handout, and a sheet's print setup all ask the same question
about paper, and all three resources name their styles the same way. Putting
either in whichever resource was built first is how one question gets three
answers — the reason `Actor` is here.

They are embedded in bodies rather than in rows, which is the one difference from
`Actor` and does not change where they belong: a body is still someone else's
stored value.

`taskId`, `automationId`, and `connectorId` are `v.string()` rather than
`v.id(...)` only because `agentTasks`, `automations`, and `connectors` do not
exist yet — `v.id` names a table the schema must declare. Each tightens in the
task that creates its table.
