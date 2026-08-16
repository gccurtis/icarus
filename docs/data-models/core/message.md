# Message

One turn in a thread. Messages are the only table here — a **thread has no
object of its own**, because the thing it belongs to is the thread.

```ts
interface Message {
  projectId: Id<"projects">;
  thread: ThreadRef;
  role: "prompt" | "response";
  blocks: ContentBlock[];
  author?: Actor;
  mentions?: Mention[];
  toolCalls?: ToolCall[];
  sources?: MessageSource[];
  state: "streaming" | "complete" | "error";
  error?: string;
}

type ThreadRef =
  | { kind: "research"; id: Id<"researchThreads"> }
  | { kind: "task"; id: Id<"agentTasks"> }
  | { kind: "persona"; id: Id<"personaThreads"> };

interface ToolCall {
  name: string;
  input: unknown;
  output?: unknown;
  state: "pending" | "success" | "error";
  error?: string;
  durationMs?: number;
}

type MessageSource =
  | { kind: "resource"; resourceType: ResourceKind; resourceId: string; title?: string; excerpt?: string }
  | { kind: "url"; url: string; title?: string; excerpt?: string }
  | { kind: "lattice"; nodeId: Id<"latticeNodes">; excerpt?: string };
```

## Threads exist only to serve their consumer

This is the same relationship [content blocks](../content/content-block.md) have
with the resources that hold them. A block has no independent existence — it is
part of a document, addressed through it, and meaningless without it. A thread is
the same: it is the conversation *of* a research thread, a task, or a persona
chat, and there is no such thing as a conversation that belongs to nothing.

So there is no `chats` table and no thread id. A
[research thread](../research/research.md),
[agent task](../ai/agent-task.md), and
[persona thread](../ai/persona-chat.md) each *are* threads, and a message names
which one it belongs to.

Neither do the consumers carry a thread pointer. Their own `_id` is the key
messages are indexed by, so "the messages of this research thread" is
`by_thread(("research", id))` — one indexed read, no field to store and nothing
to keep in sync.

**Messages are a table and blocks are not** for one reason only: a conversation
grows without bound. Embedding messages would walk a thread into Convex's
document limit and rewrite the whole history on every reply. That is a storage
necessity, not an identity — the table exists so appends are cheap, not because a
thread is a thing.

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

On a `prompt` turn, `author` is always set.

## Research steps are tool calls

Research once recorded `steps` — searched this, read that, retrieved the other —
separately from an agent's `toolCalls`. They were the same thing described twice:
research is an agent with a fixed toolset, and a search *is* a tool call.

Both are a record of work done, written as it happens and never revised. That
record exists so a person can see why an answer says what it says without
rerunning anything, and so a thin answer is recognizable as thin. Nothing reads
it to decide what to do next — it is not a plan, and that is what keeps it
honest.

## Blocks, not markdown

Message content is [content blocks](../content/content-block.md) because
responses are genuinely rich: a table of results, a chart, a code sample, a cited
excerpt. A markdown string would mean parsing on every render and would make
citations inexpressible.

## Sources

What a message drew on. When a research message becomes a
[finding](../research/finding.md), these are what its `sources` are built from —
with excerpts copied, because a finding's citations must survive independently of
the thread.

A `resource` source names both `resourceType` and `resourceId`, never the id
alone — [the pair is the
key](../revisions/change-set.md#the-resource-key-is-the-pair-named-once). `file`
and `finding` folded into it once findings became a
[resource kind](../special-resources/resource-set.md), which removed two
near-duplicate variants that differed only in which table they meant.

## Append-only

Messages are written and never reordered. Order is `_creationTime`, so no
explicit rank is needed, and the log is its own history — which is why
conversations have [no revision
model](../revisions/README.md#why-the-rest-have-none).

Changing a conversation is not undo and not revision: it is **branching**. A
thread continues from a chosen message into a new one, leaving the original
intact — see [persona chat](../ai/persona-chat.md#branching).

## Related

[actor](actor.md) · [content block](../content/content-block.md) ·
[research](../research/research.md) · [agent task](../ai/agent-task.md) ·
[persona chat](../ai/persona-chat.md)
