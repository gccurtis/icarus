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
  revision: number;
  updatedAt: number;
}
```

## A room with a job

Research is a conversation aimed at something: pull information together, test
hypotheses, work toward answers, and turn what holds up into
[findings](finding.md). More than one person can be in it, and an agent answers
alongside them.

**This row is the thread.** There is no separate conversation object, no `chatId`
and no `messages` table — the row
[holds its turns](../core/message.md#nothing-reads-a-conversation-except-the-thing-having-it)
inline, so there is no link at all. What the row
itself holds is only what makes it *research*: its mode and what it is anchored
to.

Messages are not embedded, because a conversation grows without bound and
embedding would walk the thread into Convex's document limit while rewriting the
whole history on every reply.

## Mode

`mode` says what the thread is working toward, not how attached it is.

`discover` is **looking for things** — the thread is driven by its prompt rather
than by a specific question or hypothesis. It is not "unanchored"; it is a
different job. Discovery is how questions get found in the first place, and a
discover thread producing a finding is the normal case rather than a loose end.

`question` and `hypothesis` are pointed at something, and the corresponding id is
set — which is what lets the thread appear in context on the object it belongs
to, and gives a drafted finding somewhere obvious to attach.

## Research is an agent with a fixed toolset

What the assistant did while producing a message — searched this, read that,
retrieved from the lattice — has no field of its own, and neither does an
[agent task's](../ai/agent-task.md#tool-calls-are-not-stored) equivalent. A search
*is* a tool call, so describing research steps separately was the same thing
written twice; the resolution is that
[neither is stored](../core/message.md#tool-calls-are-not-stored). What the turn
wrote down is the record.

`sources` is what a message drew on. When a message becomes a
[finding](finding.md), these are what its `sources` are built from — with
excerpts copied, because a finding's citations must survive independently of this
thread.

## Related

[question](question.md) · [finding](finding.md) ·
[message](../core/message.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md) ·
[agent task](../ai/agent-task.md)
