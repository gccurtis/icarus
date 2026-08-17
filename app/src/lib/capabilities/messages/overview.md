# Messages

One turn in a thread: content blocks, plus the little that belongs to the
grouping rather than to any block in it — who said it, when, and which side of
the exchange it is on.

## Why there is no table

**This is the one thing this document exists to say.** Without it the next reader
assumes the table was forgotten.

A conversation is never read outside its consumer, and is most of what that
consumer *is*. A persona thread minus its messages is a title and a branch
pointer. So `researchThreads`, `agentTasks`, and `personaThreads` will each hold
`messages: Message[]` inline when those tables arrive, and the row that holds the
conversation **is** the thread.

That removes more than a table. There is no `ThreadRef`, no `projectId` on a
turn, no `by_thread` index, and no `chats` table — the link between a thread and
its messages stops needing to exist rather than being stored more cheaply. It is
the same relationship [content blocks](../content/overview.md) have with the
resources holding them.

**The cost is unbounded growth**, and it is worth stating plainly. A thread's
turns share the owner row's 1 MiB budget. The escape is the one every embedded
body has — move the messages to a child table keyed by the owner if a thread type
actually approaches the cap — rather than paying for a table upfront against a
limit nothing has reached.

There is no `api/` and no deployment door either. Nothing here is callable; a
message is written by whichever capability owns the thread.

## Files

| File | Holds |
| --- | --- |
| [`errors.ts`](errors.ts) | `MessagesError`, `MessagesRefusal`, and `messagesRefusal` |
| [`types/message.ts`](types/message.ts) | `Message`, `MessageRole`, `MessageState`, and `message()` |

There is no `attachment.ts`. **An attachment is a `ResourceRef` and nothing
more**, so `attachments` is `ResourceRef[]` imported from `$shared`.

## Dependency Ports

| Capability | Usage |
| --- | --- |
| [`$content`](../content/overview.md) | `ContentBlock` — a turn's body |
| [`$shared`](../shared/overview.md) | `Actor` for the author, `ResourceRef` for attachments |

## A link is not an attachment

The two are separate acts. **A link is something inside the text**; an attachment
is something added beside it — and `Mark.link` is already the first one.

A link lives in a mark permanently. Capturing it is a downstream process that
produces an `external::web-page`, which is an ordinary resource and therefore
already a `ResourceRef`. A capture that fails needs no record either: the mark
still holds the URL, so nothing is lost and the fetch can be retried. **The text
is the durable record of the link.**

## Tool calls are not stored

No type, no field. A client holds a call's output in memory while the thread is
open; on reload only what the message actually stored survives, which may be an
ordinary text block naming the call and its inputs.

Giving them a schema would push the problem somewhere else and make every
consumer of a message learn a vocabulary belonging to one client's transcript
view.

## Capability Invariants

Both are upheld by [`message()`](types/message.ts), and it is the only way to
build a `Message` — which is what turns them from advice into something a caller
cannot get wrong.

- **A prompt names its author.** Absence means the thread's own responder, which
  a prompt has no case for. It is a constraint *between two fields*, and a Convex
  validator cannot express one.
- **`state` is derived from `error`, never supplied.** Two fields saying whether
  the turn worked can disagree; one cannot. Blocks are carried either way,
  because a turn that failed halfway still said something.
- **Append-only.** Changing a conversation is branching, not editing.
- **Messages are not lattice sources.** A conversation is working material; a
  turn worth keeping is promoted to a `finding`, and that promotion is the
  editorial act worth indexing.
