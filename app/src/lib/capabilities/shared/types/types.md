# Shared Types

Lives at `types/types.md`.

The whole of this capability. There is nothing to keep out of it — no stored row
shapes, because nothing here is a row: these are the fields other capabilities'
tables embed.

## Files

| File | Holds |
| --- | --- |
| [`actor.ts`](actor.ts) | `actorValidator`, and the `Actor` type inferred from it |
| [`mention.ts`](mention.ts) | `mentionValidator` — who a remark is addressed to |
| [`page-setup.ts`](page-setup.ts) | `pageSetupValidator`, `paperSizeValidator` — paper, orientation, margins |
| [`resource.ts`](resource.ts) | `resourceKindValidator` — what a project holds and works over |
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

## `ResourceKind` is here because three capabilities answer to it

A resource set selects by it, the lattice indexes by it, and a
[finding](../../findings/overview.md) claims to be one. Whichever of the three
was built first would be an odd place for the other two to import it from, and
the set is a statement about the *project* rather than about any of them.

It is the third union in this repository that nearly matches the other two, and
the differences are the point. The **general** resources — document, slides,
spreadsheet — are the ones a change set edits, and a finding is not among them.
What a **comment** can hang on includes questions and hypotheses, because
remarking on an open thread is exactly what people do with one, while retrieving
over it would return the asking rather than an answer.

## `Mention` is here for the same reason, and is deliberately not `Actor`

A comment and a message both address people, and the set you can *address* is not
the set that can *act*: you mention a persona, but what acts is one run of it, and
nothing is served by addressing an automation, a connector, or the system. Two
unions that nearly match are exactly the pair worth keeping in one place.

`taskId`, `automationId`, `connectorId`, and `personaId` are `v.string()` rather
than `v.id(...)` only because `agentTasks`, `automations`, `connectors`, and
`personas` do not exist yet — `v.id` names a table the schema must declare. Each
tightens in the task that creates its table.
