# Message

One turn in a conversation. The same object whether the conversation is
[research](../research/research.md), an [agent task](../ai/agent-task.md), or a
[persona chat](../ai/persona-chat.md).

```ts
interface Message {
  projectId: Id<"projects">;
  thread: ThreadRef;
  role: "user" | "assistant";
  blocks: ContentBlock[];
  author?: Actor;              // absent on assistant messages
  mentions?: Mention[];
  toolCalls?: ToolCall[];
  sources?: MessageSource[];
  state: "streaming" | "complete" | "error";
  error?: string;
}

type ThreadRef =
  | { kind: "research"; threadId: Id<"researchThreads"> }
  | { kind: "task"; taskId: Id<"agentTasks"> }
  | { kind: "persona"; threadId: Id<"personaThreads"> };

interface ToolCall {
  name: string;
  input: unknown;
  output?: unknown;
  state: "pending" | "success" | "error";
  error?: string;
  durationMs?: number;
}

interface MessageSource {
  kind: "file" | "url" | "resource" | "lattice" | "finding";
  ref: string;
  title?: string;
  excerpt?: string;
}
```

## One table, three parents

Research messages, agent task messages, and persona chat messages had identical
structure — a role, content blocks, a record of what was done, and a streaming
state. They were separate only because they hung off different parents.

Three copies of one shape is three places for it to drift, and the surfaces
already share a renderer. `thread` is a discriminated reference and the table is
indexed on it, so "messages in this conversation" is one indexed query, exactly
as it was with separate tables.

The **threads** stay distinct, because they genuinely differ: a
[research thread](../research/research.md) has a mode and an anchor, an
[agent task](../ai/agent-task.md) has a status and a plan, a
[persona thread](../ai/persona-chat.md) has neither.

## Research steps are tool calls

Research used to record `steps` — searched this, read that, retrieved the other
— separately from an agent's `toolCalls`. They were the same thing described
twice: research is an agent with a fixed toolset, and a search *is* a tool call.

So a research message's work appears as `toolCalls` with names like `search`,
`read`, and `retrieve`. The unification is not a stretch to save a field; it
reflects that both are a record of work done, written as it happens and never
revised.

That record exists so a person can see why an answer says what it says without
rerunning anything, and so a thin answer is recognizable as thin. Nothing reads
it to decide what to do next — it is not a plan, and that is what keeps it
honest.

## Blocks, not markdown

Message content is [content blocks](../content/content-block.md) because
assistant output is genuinely rich: a table of results, a chart, a code sample, a
cited excerpt. A markdown string would mean parsing on every render and would
make citations inexpressible.

## Author is an actor, and optional

Absent on assistant messages, where `role` already says who spoke. Present on
user-role messages as an [`Actor`](actor.md), because a user-role message is not
always from a user — an automation can post into a task's thread, and one agent
can address another.

## Sources

What this message drew on. When a research message becomes a
[finding](../research/finding.md), these are what its `sources` are built from —
with excerpts copied, because a finding's citations must survive independently
of the thread.

## Append-only

Messages are written and never reordered. Order is `_creationTime`, so no
explicit rank is needed, and the log is its own history — this is why
conversations have [no revision model](../revisions/README.md#why-the-rest-have-none).

Editing a conversation is not undo and not revision: it is
**branching**. A [persona thread](../ai/persona-chat.md#branching) or a research
thread continues from a chosen message into a new one, leaving the original
intact.

## Related

[actor](actor.md) · [content block](../content/content-block.md) ·
[research](../research/research.md) · [agent task](../ai/agent-task.md) ·
[persona chat](../ai/persona-chat.md)
