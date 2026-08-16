# Comments

Discussion attached to a place in the project. Threads anchor; comments hang off
them.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the discussion on one thing, or across the project |
| `start` | mutation | opens a thread with its first remark, returning its id |
| `reply` | mutation | adds a remark to one |
| `edit` | mutation | rewrites a remark, marking it as rewritten |
| `resolve` | mutation | closes a thread, naming who closed it |
| `reopen` | mutation | says it is not settled after all |

Registered in
[`src/convex/capabilities/comments.ts`](../../../convex/capabilities/comments.ts),
all six built from `projectQuery` / `projectMutation`.

There is no `remove`. See [resolved rather than deleted](#resolved-rather-than-deleted).

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `commentThreads` | one row per discussion: where it points, and whether it is settled |
| `comments` | one row per remark: what was said, by whom, and who it addresses |

## Thread and comment are separate tables

The thread owns the anchor and the resolved state; comments are the replies. A
single-comment model would have to nominate one comment as the one carrying the
anchor, and resolving a conversation would mean resolving an individual remark.

They are written together by [`start`](api/start/start.md), because a thread with
no remark on it is a marker in a document nobody can act on and nobody can tell
was a mistake.

## A comment carries its own `projectId`

It is reached only through an already-scoped thread, so the column is redundant —
and the redundancy is the point. A check that has to join upward to decide access
is a check that will eventually forget to, and
[`requireComment`](api/edit/require-comment.ts) decides from the comment's own
column and never reads the thread above it.

## Anchoring is exact, and one part of it is not

An anchor names an [id](../../../../../docs/data-models/content/content-block.md):
`#b7x2` is that block wherever it moves and whatever is inserted above it, so a
comment cannot drift onto the wrong paragraph. Blocks were positional once, and
`quote` existed to repair anchors that had silently gone wrong; ids removed that
class of problem entirely.

**The one part still positional is a text range's `from`/`to`**, which shift when
the text in front of them is edited. That is the same offset arithmetic marks
require, so [`resolveAnchor`](api/start/start.md) imports `shift` from
[`revisions`](../revisions/overview.md) rather than restating it — a second
implementation of the only function in the system that fails open would be a
second place for characters to end up in the wrong order.

`quote` is what was selected, taken from the body the author was looking at. It
renders in the comment list so a thread reads on its own without loading its
target, and it is what makes a range that has drifted recognizable as drifted.

## What you can be anchored to

`within` is absent for a remark about the whole object, and otherwise names the
smallest thing the person pointed at. Which variants are legal depends on the
target, and [`types/anchor.ts`](types/anchor.ts) is where that table lives —
a validator cannot hold it, because it is a constraint between two fields.

A slide can be commented on **as a slide**, which is the case that matters: "this
one needs rework" is about the slide, not about anything on it, and it is a
different remark from one about the deck.

There is no `row` variant. Nobody points at a row; they select text, or they
comment on the document. Rows are layout.

## Resolved rather than deleted

`resolved` hides a thread without destroying it, and there is no function here
that deletes one. Review discussions are often the only record of why something is
the way it is, and deleting on resolve throws that away at precisely the moment it
starts being useful. Which surface hides a resolved thread is that surface's
decision — [`list`](api/list/list.md) returns them.

**`resolvedBy` is a user while `createdBy` and `author` are actors.** Anything can
raise a remark — an agent reviewing a document routinely does — but deciding a
question is settled is a judgement a person makes.

## Capability Invariants

- **A refusal is "not found", never "forbidden."** A thread in another project
  answers exactly as one that never existed; telling them apart would confirm that
  a discussion about something is happening.
- **Attribution is built from the scope**, never accepted as an argument — for the
  author of a remark and for the resolver of a thread alike.
- **An anchor is resolved before it is stored.** The `within` a target cannot hold
  is refused, and the id it names must be in the resource as it now stands.
- **Only the person who said something may change it**, which puts an agent's
  remarks beyond editing by anyone. A comment is attributed, and rewriting words
  under somebody else's name changes what they are recorded as saying.
- **Every mutation records its activity in the same transaction.**
- **Every refusal is thrown as `CommentsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| `question`, `hypothesis`, and `finding` anchors resolve against nothing | pass 4 | those tables exist; an anchor is a kind string and an id, so it never needed them to |
| `mentions` is a column nothing reads | pass 5, pass 7 | mentioning a persona opens a chat carrying the comment as context; mentioning a task delivers into that task's thread |
| "comments mentioning me" would be a scan | with notifications | Convex has no array-containment index, so the lookup is derived from this column — which is what extracting mentions beside the blocks buys, since it can be built without opening a single comment body |

## Related

[comment](../../../../../docs/data-models/collaboration/comment.md) — the model
this implements ·
[actor](../../../../../docs/data-models/core/actor.md) — `Actor` and `Mention`, and
why they are different unions ·
[revisions](../revisions/overview.md) — whose `shift` an anchor's offsets move by
