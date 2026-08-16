# Messages

Every turn in every conversation, in one table. Research threads, agent tasks,
and persona chats all talk through this.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one thread's turns, oldest first |
| `post` | mutation | appends a turn, returning its id |
| `finish` | mutation | closes a turn a responder was still producing |

Registered in
[`src/convex/capabilities/messages.ts`](../../../convex/capabilities/messages.ts),
all three built from `projectQuery` / `projectMutation`.

There is no `edit` and no `remove`. See [append-only](#append-only).

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `messages` | one row per turn: what was said, which side it is on, and what it drew on |

## There is no thread object

A research thread, an agent task, and a persona thread each **are** threads. A
message names which one it belongs to, and that is the whole relationship —
`by_thread(("research", id))` is one indexed read.

Neither do the consumers carry a thread pointer. Their own `_id` is the key
messages index on, so there is no field on either side to keep in sync and
nothing to create before somebody can speak.

**Messages are a table and blocks are not** for one reason: a conversation grows
without bound, and embedding turns would walk a thread into Convex's document
limit while rewriting the whole history on every reply. That is a storage
necessity, not an identity.

## `role` is `prompt | response`

A thread is a room, not a two-party exchange. With three people and an agent in
one, `"user"` would be four different actors wearing one label — so role says
which side of the exchange a turn is on, and `author` says who took it.

**`author` is required on a prompt and optional on a response.** Absence on a
response means *the obvious responder*: a persona answering in its own chat, a
task reporting in its own thread. Presence always names someone else — another
person, or a persona brought in by a mention. A prompt has no obvious asker, so
an unauthored one is a question from nobody.

A validator cannot state a constraint between two fields, so
[`post`](api/post/post.md) enforces it. Through the door the case never arises:
the author is built from the scope, and a caller at the door is never the
thread's own responder.

## Research steps are tool calls

Research once recorded searched-this, read-that separately from an agent's tool
calls. They were the same thing described twice — research is an agent with a
fixed toolset, and a search *is* a tool call — so there is no `steps` field.

A tool's `input` and `output` are opaque. Every tool's payload is different and
the tool implementation is the only thing that can interpret its own arguments,
so normalizing them into a schema would either exclude a tool or describe none
of them.

Nothing reads the record to decide what to do next. It is a record of work done,
not a plan, and that is what keeps it honest.

## Append-only

Turns are written and never reordered. Order is `_creationTime`, so there is no
rank column, and the log is its own history — which is why there is no
`revision` and no edit.

**Changing a conversation is branching**, not undo and not revision: a thread
continues from a chosen message into a new one and the original stays intact.
[`personaThreads.branch`](../../persona-threads/api/branch/branch.md) records
where a branch came from; nothing is recorded here.

[`finish`](api/finish/finish.md) is the one write after a post, and only while
the turn is `streaming` — a turn opened before its content exists is not an
exception to append-only, it is one append that arrives in two parts.

## Blocks, not markdown

Responses are genuinely rich: a table of results, a chart, a code sample, a cited
excerpt. A markdown string would mean parsing on every render and would make a
citation inexpressible.

## No activity entry

Alone among the mutating capabilities here, nothing in this one calls
[`record`](../activity/api/shared/shared.md). A conversation is *already* an
append-only ordered log, read by thread and complete on its own; copying every
turn into the project feed would be a second record of the same events, and it
would swamp the feed with the one thing that least needs it — a forty-turn chat
is forty entries saying a chat happened.

What belongs in the log is the thread being started, and that is written by the
capability that owns the thread row.

## Capability Invariants

- **A refusal is "not found", never "forbidden."** A turn in another project
  answers exactly as one that never existed; telling them apart would confirm
  that a conversation about something is happening.
- **Access is decided by the message's own `projectId`.** No read joins upward
  to a thread row, because a check that has to join upward is a check that will
  eventually forget to.
- **Attribution is built from the scope**, never accepted as an argument.
- **A prompt names who is asking.** The one cross-field rule, enforced in the
  mutation because a validator cannot express it.
- **A settled turn is never rewritten.** `finish` refuses anything that is not
  `streaming`.
- **Every refusal is thrown as `MessagesError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| a `ThreadRef` names a row nothing can check exists | when a turn is posted into a task | every kind now names a real table, so `post` can prove the thread is in the caller's project rather than trusting the id |
| `sources.lattice.nodeId` is `v.string()` | pass 6 | `v.id("latticeNodes")` |
| a message cannot be promoted to a finding from here | when the two meet | [`findings.create`](../findings/api/create/create.md) already takes the writeup and the citations; what is missing is the excerpt copying that makes a finding's sources survive the thread |

## Related

[message](../../../../../docs/data-models/core/message.md) — the model this
implements ·
[research](../../../../../docs/data-models/research/research.md) ·
[persona chat](../../../../../docs/data-models/ai/persona-chat.md) ·
[content block](../content/overview.md) — what a turn is made of ·
[findings](../findings/overview.md) — where a turn worth keeping ends up
