# Persona chat

A conversation with a [persona](persona.md) that is not a task. Somewhere to ask
a question, think out loud, or find out what its tasks are up to — before
committing to work that needs tracking.

```ts
interface PersonaThread {
  projectId: Id<"projects">;
  personaId: Id<"personas">;
  title: string;
  branchedFrom?: { threadId: Id<"personaThreads">; messageId: Id<"messages"> };
  createdBy: Actor;
  updatedAt: number;
}
```

This row is the thread. It holds its
[messages](../core/message.md#nothing-reads-a-conversation-except-the-thing-having-it)
inline; there is no separate conversation object and no `messages` table.

## Why this is not a task

An [agent task](agent-task.md) has a goal, a status, a plan, and a result. It is
work that is tracked because someone wants it finished. A chat has none of that
and should not pretend to: asking "what did you find in the Q3 scan" is not a
unit of work, and giving it a status field would mean every question needs
closing.

The thread carries almost nothing beyond its persona because there is almost
nothing to carry. That is the point of it existing separately.

## Mentioning a persona opens one

A [mention](../core/actor.md#mentions-are-the-mirror-image) of a persona — in a
comment, in another chat — addresses the persona and lands in a thread with it.
Mentioning a specific *task* instead delivers into that task's own thread, which
is how to say something to work already in progress.

This is why `Mention` addresses personas while `Actor` identifies tasks. You
talk to the durable identity; the run is what acts.

## Awareness without control

A persona can see the tasks running under it, and can see that other tasks exist
in the project. It has no control over any task that is not its own.

That boundary needs no field to express it. A task's `personaId` already says
whose it is, so "mine" is a comparison rather than a permission record. Modelling
it as grants would invent an access system to answer a question the data already
answers.

The useful consequence is that asking a persona what its work has turned up is
just a chat — it reads its own tasks' messages and results and answers, without a
reporting mechanism existing anywhere.

## Branching

A thread can continue from any earlier message into a new thread, recorded in
`branchedFrom`. The original is untouched.

Branching is the answer to "I want to change what I said" in every conversation
in Icarus. Messages are append-only, so there is no editing a chat and no undoing
one — you take a different path from a point you liked, and both paths remain.

A task can be spun off the same way: an [agent
task](agent-task.md#branching-from-a-chat) records the thread and message it
branched from, and inherits the conversation up to that point as context. That is
the path from thinking out loud to work that gets tracked.

## Access

Any project member can read any persona thread, like
[comments](../collaboration/comment.md). Threads are project content rather than
private correspondence, and a chat that turned into a task is part of why the
task exists.

Finer-grained access is deliberately not modelled. Membership in a project is a
good enough boundary at this stage, and adding a second one now would mean
guessing at rules nobody has needed yet.

## Related

[persona](persona.md) · [message](../core/message.md) ·
[agent task](agent-task.md) · [actor](../core/actor.md)
