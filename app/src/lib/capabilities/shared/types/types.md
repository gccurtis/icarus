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
| [`set-expression.ts`](set-expression.ts) | `setExpressionValidator`, `resourceRefValidator` — how a group of resources is named |
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

## `SetExpression` is here before the table that stores one

A [persona's](../../personas/overview.md) scope, a prompt block's, and a derived
output's inputs are one question, and `resourceSets` — the table that *names* an
expression — is only the fourth thing to ask it. Putting the grammar in that
table would make three capabilities import their scope from a fifth.

**Its nesting is unrolled to a fixed depth rather than recursive**, because a
Convex validator is data and cannot refer to itself. `{ op: "set" }` is what goes
deeper, which is not a workaround: an expression worth nesting further is an
expression worth naming.

## `Mention` is here for the same reason, and is deliberately not `Actor`

A comment and a message both address people, and the set you can *address* is not
the set that can *act*: you mention a persona, but what acts is one run of it, and
nothing is served by addressing an automation, a connector, or the system. Two
unions that nearly match are exactly the pair worth keeping in one place.

## Two of `Actor`'s five kinds still carry a `v.string()` id

`taskId` no longer does: `agentTasks` exists, so an agent actor names a real row
and a fabricated origin is refused at the door rather than stored.

`automationId` and `connectorId` are still strings, because `v.id` names a table
the schema must declare and neither table is buildable yet — `automations` waits
on scheduling infrastructure, `connectors` on OAuth, webhooks, and provider sync.
Both are pass 8, and each tightens in the task that creates its table, as
`taskId` and `personaId` did.
