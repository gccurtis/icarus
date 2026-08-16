# Messages Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`thread.ts`](thread.ts) | `threadRefValidator`, `ThreadRef`, `ThreadKind` |
| [`message.ts`](message.ts) | `messageRoleValidator`, `messageStateValidator`, `Message`, `MessageDraft`, `MessageOutcome`, `messageAuthor` |
| [`tool-call.ts`](tool-call.ts) | `toolCallValidator`, `ToolCall` |
| [`source.ts`](source.ts) | `messageSourceValidator`, `MessageSource` |

## `ThreadRef` is the whole relationship

`schema.ts` indexes it and the door validates it, which makes the column's three
variants and the door's refusal of a fourth the same statement.

**`id` stays one column across all three variants**, because a Convex id *is* a
string: no reader has to choose a branch to render one conversation, and each
variant can still name its own table. `research` names
[`researchThreads`](../../research-threads/overview.md); `persona` and `task`
wait for `personaThreads` in task 22 and `agentTasks` in pass 7.

The discriminant is half the key, not decoration. Two tables may hand out the
same id, so `by_thread` reads `(kind, id)` and a read on the id alone would
merge two conversations.

## `messageAuthor` states the rule the schema cannot

`v.optional(actorValidator)` says an author may be absent. What it cannot say is
that absence is legal only on a `response`, because that is a constraint between
two fields.

The asymmetry is the model, not a leniency: absence means *the obvious
responder*, and a prompt has no obvious asker. Every write goes through this
function, so an unauthored prompt cannot reach the table by another route.

## `MessageOutcome` carries no state

`finish` derives `state` from whether `error` is present. Sending both would let
them disagree — a turn marked `complete` carrying the error that killed it — and
the blocks are stored either way, because a turn that failed halfway still said
something.

## `Message` is not the row

It carries `id` and `at`, and drops `projectId` and `thread`: a read is always of
one thread, so repeating which one per turn says nothing. `at` is
`_creationTime`, which is also the order — appends are the only writes.

## A message source is not a finding's source

Both name a resource by `(resourceType, resourceId)`, and there the similarity
stops. A message's `excerpt` is working material with no `capturedAt`, because
the thread is live and re-readable. A
[finding's](../../findings/types/finding.ts) is a citation, dated and required to
survive independently of anything it came from — which is exactly what promoting
a message copies.

The `resourceType` here is the full
[`resourceKindValidator`](../../shared/types/resource.ts) rather than the general
resources alone: a turn cites an uploaded file or an earlier finding as readily
as a document.
