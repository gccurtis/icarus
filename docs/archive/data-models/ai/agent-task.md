# Agent task

A unit of work handed to an agent. The task holds the goal and the outcome; its
messages hold the conversation that got there.

```ts
interface AgentTask {
  projectId: Id<"projects">;
  title: string;               // the name — short, identifying
  prompt: string;              // the kickoff prompt, verbatim
  description?: string;        // a summary, inferred from the prompt
  personaId?: Id<"personas">;
  branchedFrom?: { threadId: Id<"personaThreads">; messageId: Id<"messages"> };
  status: "draft" | "running" | "waiting" | "complete" | "failed" | "cancelled";
  origin: Actor;               // who dispatched this task
  plan?: PlanStep[];
  result?: ContentBlock[];
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  updatedAt: number;
}

interface PlanStep {
  description: string;
  status: "pending" | "active" | "done" | "skipped" | "failed";
}

interface PlanStep {
  description: string;
  status: "pending" | "active" | "done" | "skipped" | "failed";
}
```

This row is the thread. It holds its
[messages](../core/message.md#nothing-reads-a-conversation-except-the-thing-having-it)
inline — there is no `messages` table and no link to store.

## Three names for three jobs

`prompt` is the kickoff instruction, verbatim and unedited. It is what gets sent
to the model, so it is a plain string — formatting it would mean serializing
blocks back to text at the moment the text is what matters. It is also the
task's provenance: everything the task did traces back to it, so it is never
rewritten.

`title` is the short, identifying name. It is not decoration — it is the
`detail` field of every [actor label](../core/actor.md#resolving-a-label) the
task produces, so it is what a person reads in a feed months later next to the
persona and the dispatcher. Worth generating well from the prompt.

`description` is a longer summary, and optional. Inferred from the prompt when
inference exists; absent until then. It is separate from `prompt` because a
summary that overwrote the original would destroy the provenance, and separate
from `title` because a name that grew to a paragraph would stop working as a
label.

`result` is blocks, because the output is content: a written answer, a table, a
chart, a draft. It is the deliverable, extracted rather than requiring anyone to
read the whole thread to find it.

## Timing and attribution are already here

`origin` says who dispatched the task. Convex's `_creationTime` says when it came
into existence, `startedAt` when it began running, and `finishedAt` when it
stopped — three distinct moments, because a queued task and a running one are not
the same thing and the gap between them is worth seeing.

Per-turn timing lives on the messages, which each carry their own
`_creationTime`, so how long a task spent on any particular step is answerable
without the task tracking it.

## Branching from a chat

`branchedFrom` records the [persona chat](persona-chat.md#branching) message a
task was spun off from. The task inherits the conversation up to that point as
context.

This is the path from thinking out loud to work that gets tracked: talk to a
persona, reach a point worth acting on, branch a task from that message. The
chat is untouched and remains readable as the reason the task exists.

## Tool calls are not stored

They have no field here and no field on a
[message](../core/message.md#tool-calls-are-not-stored). A call's output lives in
the client while the thread is open; on reload, what survives is whatever the
turn actually wrote down.

That is a deliberate reversal of the obvious answer, and the reasoning is that a
typed call log is a rendering concern wearing a schema. Every tool's payload is
different, so the stored shape would be `unknown` either way — and then every
consumer of a message has to learn a vocabulary belonging to one client's
transcript view.

What a task's behaviour actually needs to be explainable after the fact is
prose: a turn saying what it searched and what it found, in ordinary blocks that
render, search, and promote to a [finding](../research/finding.md) like anything
else. If that proves insufficient in practice, the answer is a block variant
argued on its own merits, not a payload bag restored by default.

## Plan

`plan` is optional and it is a checklist, not a graph. Dependencies, branching,
and retries are execution concerns; what is worth storing is what the agent said
it would do and how far it got, because that is what a person watches.

It is allowed to be wrong — an agent that revises its plan rewrites the list.
Preserving plan history would be preserving a record of intentions nobody acts
on.

## Origin

`origin` is the shared [`Actor`](../core/actor.md) type and replaces a separate
`createdBy` — who dispatched a task is the only creation question it has.

Tasks come from a person, from an [automation](automation.md), or from another
task. The third case is what makes delegation traceable: an `agent` origin's
`taskId` is the parent, so a tree of work has a root and a runaway loop is
visible as depth.

Dispatching a task does not make the dispatcher the actor of the work. Changes
the task makes are attributed to the task, [not to the person who asked for
it](../core/actor.md#the-user-behind-an-agent-is-not-the-actor) — which is what
keeps an agent's edits out of that person's undo stack.

## Title carries into attribution

`title` is not decoration. It is the `detail` half of an agent's [actor
label](../core/actor.md#resolving-a-label): the persona says who, the title says
what. "Researcher · Q3 competitive scan" identifies a change in a way that
neither half does alone, since several tasks run the same persona.

That makes the title worth generating well when a task is created from a bare
goal, because it is what a person reads in a feed months later.

## Status

`waiting` is separate from `running` — a task blocked on human input is not
consuming anything and should not look like one that is. `cancelled` is separate
from `failed` for the same reason: someone stopping a task is not an error, and
merging them makes failure rates meaningless.

## Related

[persona](persona.md) · [automation](automation.md) ·
[intelligence](../../processes/intelligence.md) ·
[research](../research/research.md)
