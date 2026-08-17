# Message

One turn in a thread. **Not a table** — a message is an embedded value, and so is
the thread it belongs to. The row that holds the conversation *is* the thread.

```ts
interface Message {
  id: string;                  // local to the thread, like a row id
  role: "prompt" | "response";
  author?: Actor;              // absent = the thread's own responder
  sentAt: number;              // when, not order
  blocks: ContentBlock[];
  attachments?: ResourceRef[];
  labels?: string[];
  state: "streaming" | "complete" | "error";
  error?: string;
}
```

There is no `projectId` and no thread reference. Both belonged to a `messages`
table, and both stop needing to exist once the owner holds its own turns.

## Nothing reads a conversation except the thing having it

This is the same relationship [content blocks](../content/content-block.md) have
with the resources that hold them. A block has no independent existence — it is
part of a document, addressed through it, and meaningless without it. A message
is the same: it is the conversation *of* a research thread, a task, or a persona
chat, and there is no such thing as a conversation that belongs to nothing.

So a [research thread](../research/research.md),
[agent task](../ai/agent-task.md), and [persona thread](../ai/persona-chat.md)
each hold `messages: Message[]` inline. There is no `chats` table, no `messages`
table, no thread id and no `by_thread` index — **the link stops needing to exist
at all**, rather than being stored more cheaply.

A conversation is also most of what its consumer is. A persona thread minus its
messages is a title and a branch pointer, so splitting the two put the smaller
half in the row and the substance somewhere else.

**What this trades away is unbounded growth**, and that is the honest cost. A
thread's turns share the owner row's 1 MiB budget. The escape is the one
[every embedded body has](../README.md#document-size) — move the messages to a
child table keyed by the owner if a thread type actually approaches the cap —
rather than paying for a table upfront against a limit nothing has reached.

## Why the research group is different

[Questions](../research/question.md),
[hypotheses](../research/hypothesis.md),
[findings](../research/finding.md), and research threads all reference each other
and none of them is subordinate. Each has its own purpose and can exist alone: a
finding turned up by discovery answers no question yet, a question can be filed
with nothing attached, a hypothesis can be a hunch before it is anchored.

That is what makes them top-level tables with their own identity, and messages
not. Containment is not the test — *independent purpose* is.

## Several people in one thread

A thread is a room, not a two-party exchange. More than one person can post, and
`author` is what says who.

`role` is which side of the exchange a turn is on — `prompt` for a turn addressed
to the responder, `response` for what comes back. It is not identity, which is
why it is not `"user" | "assistant"`: with three people and an agent in a thread,
"user" would be four different actors wearing one label.

`author` is absent on a `response` when the thread's own owner produced it — a
persona answering in its own chat, a task reporting in its own thread. It is
present when anyone else did: another person, or a persona brought in by a
[mention](actor.md#mentions-are-the-mirror-image). So absence means "the obvious
responder", and presence always names someone.

On a `prompt` turn, `author` is always set. That constraint holds between two
fields, so no validator can state it — it lives in the constructor every message
is built through, alongside the rule that `state` is derived from `error` rather
than supplied beside it.

## Blocks, not markdown

Message content is [content blocks](../content/content-block.md) because
responses are genuinely rich: a table of results, a chart, a code sample, a cited
excerpt. A markdown string would mean parsing on every render and would make
citations inexpressible.

## Tool calls are not stored

An agent's calls — searched this, read that, retrieved the other — have no type
here and no field. They are a client concern: the client holds a call's output in
memory while the thread is open, and on reload only what the message actually
stored survives.

What survives is whatever the turn wrote down, which may be an ordinary text
block naming the call and its inputs. That is deliberate. Giving tool calls a
schema would mean every consumer of a message learns a vocabulary that belongs to
one client's rendering, and the record a person actually needs — why an answer
says what it says — is prose, not a typed log.

Research once recorded `steps` separately from an agent's calls, and they were
the same thing described twice: research is an agent with a fixed toolset, and a
search *is* a tool call. Neither survives.

## Attachments

What a turn pulled in alongside itself, as plain
[`ResourceRef`](../special-resources/resource-set.md) — a kind and an id, nothing
else. There is no attachment type.

**Named `attachments`, not `sources`.** A source is a narrower claim; it implies
the turn drew a conclusion from the thing. These are just what was pulled in.

**No excerpts and no titles.** The ref finds the thing, and a message is working
material. Where an excerpt has to outlive the thread — a
[finding](../research/finding.md)'s citation — it is copied and dated at
promotion, which is the point at which someone decided it was worth keeping.

**A link is not an attachment.** A URL a person typed lives in the text, as a
[mark](../content/content-block.md); capturing it produces an
[external file](../special-resources/external-file.md), which is a resource like
any other and therefore already a `ResourceRef`. The text is the durable record
of the link, so a capture that fails loses nothing and can be retried.

## Append-only

Messages are written and never reordered. **Order is array position** — the owner
appends — so nothing sequences on `sentAt`, which exists only to display a time.
A linked list is what you reach for when rows sit unordered in a table; an array
is already ordered.

The log is its own history, which is why conversations have [no revision
model](../revisions/README.md#why-the-rest-have-none).

Changing a conversation is not undo and not revision: it is **branching**. A
thread continues from a chosen message into a new one, leaving the original
intact — see [persona chat](../ai/persona-chat.md#branching).

## Related

[actor](actor.md) · [content block](../content/content-block.md) ·
[research](../research/research.md) · [agent task](../ai/agent-task.md) ·
[persona chat](../ai/persona-chat.md) ·
[stage 0](../../stage-0/0-foundation-design.md#message--decorated-content-blocks)
