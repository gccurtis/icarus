# Shared Types

Lives at `types/types.md`.

The whole of this capability. There is nothing to keep out of it — no stored row
shapes, because nothing here is a row: these are the fields other capabilities'
tables embed.

## Files

| File | Holds |
| --- | --- |
| [`actor.ts`](actor.ts) | `actorValidator`, and the `Actor` type inferred from it |

The validator is the source and the type is derived from it, not the other way
round. A hand-written `Actor` beside a hand-written validator is two statements
of one fact, and a table would eventually accept a shape the type forbids.

`taskId`, `automationId`, and `connectorId` are `v.string()` rather than
`v.id(...)` only because `agentTasks`, `automations`, and `connectors` do not
exist yet — `v.id` names a table the schema must declare. Each tightens in the
task that creates its table.
