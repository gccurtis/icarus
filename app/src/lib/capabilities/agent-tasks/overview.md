# Agent Tasks

A unit of work handed to an agent. The task holds the goal and the outcome; its
[messages](../messages/overview.md) hold the conversation that got there.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's tasks, narrowed by status or persona |
| `read` | query | one task whole — the prompt it was given and what came of it |
| `dispatch` | mutation | hands a goal to an agent, returning the task's id |
| `cancel` | mutation | stops one somebody no longer wants finished |

Registered in
[`src/convex/capabilities/agentTasks.ts`](../../../convex/capabilities/agentTasks.ts),
all four built from `projectQuery` / `projectMutation`.

**Running a task is not public.**
[`startRun`, `waitForInput`, `setPlan`, `completeTask`, and `failTask`](api/shared/shared.md)
are registered nowhere: a client that could declare a task complete could put a
fabricated deliverable under its id and have the feed sign it with the agent's
name.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `agentTasks` | one row per task: the goal, where it stands, what it planned, and what it produced |

## The row is the thread

There is no `chatId` and no separate conversation object.
[Messages](../messages/overview.md) name this row, `by_thread(("task", id))` is
the whole link, and the task's tool calls ride on the turns that made them —
every tool's payload is different, and the turn that called it is the only place
its input and output mean anything.

## Three names for three jobs

**`prompt`** is the kickoff instruction, verbatim and unedited — not even
trimmed. It is what gets sent to the model, so it is a plain string, and it is
the task's provenance: everything the task did traces back to it. The argument
against rewriting it later is that it has never been rewritten.

**`title`** is the short identifying name, and it is not decoration. It is the
`detail` half of every [actor label](../activity/overview.md) the task produces —
*Researcher · Gabriel Curtis · Q3 competitive scan* — so it is what a person
reads in a feed months later, next to the persona and the dispatcher.

**`description`** is the longer summary, and optional. Separate from the prompt
because a summary that overwrote the original would destroy the provenance, and
separate from the title because a name that grew to a paragraph would stop
working as a label.

## Dispatching does not make the dispatcher the actor

`origin` says who asked for the work. Changes the task makes are attributed to
**the task** — [`taskActor`](types/agent-task.ts) — which is what keeps an
agent's hundred edits out of that person's Ctrl-Z: undo selects change sets whose
`actor.kind` is `"user"`.

The dispatcher is still named, for display, by the `onBehalfOf` half of the
label. A generous label is not a loose reference: the label is never what code
compares.

An `agent` origin's task is the **parent**, which is what makes delegation
traceable — a tree of work has a root, and a runaway loop is visible as depth.
[`requireOrigin`](api/dispatch/dispatch.md) proves the parent is a task the
caller can see, because a tree hanging off an unreachable id has no root at all.

## Six states, and no two of them collapse

`draft` · `running` · `waiting` · `complete` · `failed` · `cancelled`.

**`waiting` is not `running`.** A task blocked on human input consumes nothing
and should not appear beside one burning through a model's context.

**`cancelled` is not `failed`.** Somebody stopping a task is not an error, and
merging them makes a failure rate a measure of how often people change their
minds. `cancel` writes no `error`, and it is the only end to a run whose actor is
a person rather than the task.

The moves between them live in one table, in
[`transition.ts`](api/shared/shared.md), rather than as a guard per entry point
free to disagree with the others.

## Three moments, not one

`_creationTime` is when the task came into existence, `startedAt` when a runner
picked it up, `finishedAt` when it stopped — because a queued task and a running
one are not the same thing, and the gap between them is the only measure of how
long work sat waiting. `startedAt` is stamped once, so a task answered after an
hour of `waiting` still began when it began.

Per-turn timing lives on the messages, which each carry their own
`_creationTime`.

## The plan is a checklist, and it is allowed to be wrong

Dependencies, branching, and retries are execution concerns belonging to whatever
runs the task. What is worth storing is what the agent said it would do and how
far it got, because that is what a person watches.

An agent that revises its plan rewrites the list.
[No history is kept](api/shared/shared.md) — previous plans are a record of
intentions nobody acts on.

## Branching from a chat

`branchedFrom` records the [persona chat](../persona-threads/overview.md) message
a task was spun off from; the task inherits the conversation up to that point as
context and **the chat is untouched**. This is the path from thinking out loud to
work that gets tracked, and the chat remains readable as the reason the task
exists.

## Capability Invariants

- **A refusal is "not found", never "forbidden."** A task in another project
  answers exactly as one that never existed; telling them apart confirms that
  work is being done somewhere the caller cannot see.
- **`origin` is a parameter, never an argument.** The door builds the caller's
  own actor from the scope; a task delegating work calls the handler directly.
- **A prompt is stored exactly as written**, and a blank one is refused.
- **A title is trimmed and never empty**, because a blank one is a change in an
  audit log that says only which persona made it.
- **A task stops once.** The three terminal states are terminal, and a second
  attempt is refused as `already-finished` rather than overwriting how it ended.
- **Every mutation records its activity in the same transaction** — dispatched,
  completed, failed, cancelled. The runner's own progress does not, because a
  feed entry per plan revision would bury the four moments a person reads.

## Deferred

| Today | When | Becomes |
| --- | --- | --- |
| a dispatched task sits in `draft` until something calls `startRun` | the intelligence capability | an action that runs the prompt, posts turns, and drives the lifecycle |
| `branchedFrom` is a reference a reader follows | same | the earlier turns loaded as the run's opening context |

## Related

[agent task](../../../../../docs/data-models/ai/agent-task.md) — the model this
implements ·
[actor](../../../../../docs/data-models/core/actor.md) — why the task and not the
dispatcher ·
[personas](../personas/overview.md) — who the task runs as ·
[messages](../messages/overview.md) — every turn of it
