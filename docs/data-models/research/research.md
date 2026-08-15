# Research

The working conversation. Where questions get explored, sources get pulled in,
and [findings](finding.md) get drafted before they are committed.

```ts
interface ResearchThread {
  projectId: Id<"projects">;
  title: string;
  mode: "discover" | "question" | "hypothesis";
  questionId?: Id<"questions">;
  hypothesisId?: Id<"hypotheses">;
  createdBy: Actor;
  updatedAt: number;
}

```

Messages are [`Message`](../core/message.md) rows with a
`{ kind: "research" }` thread reference.

## Messages are not embedded

The thread holds metadata only. A conversation grows without bound, so embedding
messages would walk a thread into Convex's document limit and rewrite the entire
history on every reply.

They are the shared [`Message`](../core/message.md) type rather than a research
-specific one — a research message, an agent task message, and a persona chat
message had identical structure, and three copies of one shape is three places
for it to drift.

## Mode

`mode` says what the thread is for. `discover` is open exploration with nothing
attached. `question` and `hypothesis` are anchored, and the corresponding id is
set — which is what lets the thread be shown in context on the object it belongs
to, and what gives a drafted finding somewhere obvious to attach.

## Research is an agent with a fixed toolset

What the assistant did while producing a message — searched this, read that,
retrieved from the lattice — is recorded as
[tool calls](../core/message.md#research-steps-are-tool-calls), the same field an
agent task uses. A search *is* a tool call, and describing it separately was the
same thing written twice.

`sources` is what a message drew on. When a message becomes a
[finding](finding.md), these are what its `sources` are built from — with
excerpts copied, because a finding's citations must survive independently of this
thread.

## Related

[question](question.md) · [finding](finding.md) ·
[message](../core/message.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md) ·
[agent task](../ai/agent-task.md)
