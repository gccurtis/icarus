# Persona Threads

A conversation with a [persona](../personas/overview.md) that is not a task.
Somewhere to ask a question, think out loud, or find out what its tasks are up
to — before committing to work that needs tracking.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's chats, or the ones with one persona |
| `read` | query | one thread, opened by its own address |
| `start` | mutation | opens one with a persona, returning its id |
| `branch` | mutation | continues from an earlier message into a new thread |
| `rename` | mutation | retitles one |

Registered in
[`src/convex/capabilities/personaThreads.ts`](../../../convex/capabilities/personaThreads.ts),
all five built from `projectQuery` / `projectMutation`.

There is no `remove`. Deleting a thread has to take its messages with it, and a
conversation is the one thing here nobody can reconstruct — so it waits until
there is a decision about whether that is an archive or a delete.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `personaThreads` | one row per chat: who it is with, what it is called, and where it branched from |

## The row is the thread

There is no `chatId` and no separate conversation object.
[Messages](../messages/overview.md) name this row, and
`by_thread(("persona", id))` is the whole link — one indexed read, with no field
on either side to keep in sync and nothing to create before somebody can speak.

## Why this is not a task

An agent task has a goal, a status, a plan, and a result: it is work that is
tracked because someone wants it finished. A chat has none of that and should not
pretend to — asking "what did you find in the Q3 scan" is not a unit of work, and
a status field would mean every question needs closing.

The row carries almost nothing beyond its persona because there is almost nothing
to carry. That is the point of it existing separately.

## Branching is how you change what you said

Messages are append-only, so there is no editing a chat and no undoing one. You
take a different path from a point you liked, and both paths remain.

[`branch`](api/branch/branch.md) records the thread and message it continued
from and **touches neither**. It copies no messages: what came before is reached
through `branchedFrom`, and a copy would be a second version of an append-only
log, free to disagree with the first.

## Access is membership, and nothing finer

Any project member can read any persona thread. These are project content rather
than private correspondence, and a chat that turned into a task is part of why
the task exists.

Finer-grained access is deliberately not modelled. Membership is a good enough
boundary at this stage, and a second one now would mean guessing at rules nobody
has needed yet.

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A thread in another project
  answers exactly as one that never existed; telling them apart confirms that a
  conversation with somebody is happening.
- **A branch point is a pair that agrees.** The message named must be a turn of
  the thread named, or the new thread claims to continue from something nobody
  can reach by reading where it says it came from.
- **A branch keeps its source's persona.** A branch is the same conversation
  taking another route; letting it change who is being talked to would make
  `branchedFrom` name a thread it has nothing to do with.
- **A persona is resolved by
  [`requirePersona`](../personas/api/shared/shared.md)**, so the rule that an
  absent project means every project is stated once, in the capability that owns
  it — and that refusal reaches the caller as the personas capability's own.
- **Attribution is built from the scope**, never accepted as an argument.
- **A title is trimmed and never empty**, because it is what a list of chats
  renders without loading a message.
- **Every mutation records its activity in the same transaction.**

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| a branch is a reference and a reader follows it one hop at a time | pass 7 | the same record is what an agent task inherits as context when it is spun off a chat |

## Related

[persona chat](../../../../../docs/data-models/ai/persona-chat.md) — the model
this implements ·
[personas](../personas/overview.md) — who the chat is with ·
[messages](../messages/overview.md) — every turn in it
