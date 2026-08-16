# Shared Agent Task Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-task.ts`](require-task.ts) | that a task id names a task in the caller's project, and that a caller learns nothing from the answer when it does not |
| [`as-task.ts`](as-task.ts) | that the stored row stops at the boundary, and that a list and a read cannot disagree about a column |
| [`transition.ts`](transition.ts) | that the lifecycle is one table, and that a task stops once |
| [`lifecycle.ts`](lifecycle.ts) | that running a task is not something a client can claim to have done |

## `transition.ts` is the lifecycle, in one place

`moveTo` holds what may follow what. Every caller that changes a status goes
through it — the runner's steps and a person's
[`cancel`](../cancel/cancel.md) alike — so there is one table rather than a guard
per entry point, free to drift from the others.

The three terminal states are empty on purpose: a completed run that could be
failed later would make "how often does this fail" a question about who wrote
last. `already-finished` is told apart from `bad-transition` because they are
different answers — the first says somebody got there first, the second says the
caller asked for something that is not a move.

## `lifecycle.ts` is called from outside this capability

Like [`activity`'s `record`](../../../activity/api/shared/shared.md) and
[derived outputs' `generation.ts`](../../../derived-outputs/api/shared/shared.md),
its callers are elsewhere: whatever actually runs the task, inside the same
transaction as its own writes.

**All five are registered nowhere.** The `api/` set and the deployment door name
the same functions, and none of these is in either, because a client that could
declare a task complete could put a fabricated deliverable under its id and have
the feed sign it with the agent's name.

```text
startRun(ctx, scope, id)        │ waitForInput  │ setPlan       │ completeTask  │ failTask
├── requireTask(ctx, scope, id) │ requireTask   │ requireTask   │ requireTask   │ requireTask
├── moveTo(ctx, task, "running")│ moveTo …      │ ctx.db.patch  │ moveTo …      │ moveTo …
└── —                           │ —             │ —             │ record(…)     │ record(…)
```

`startRun` stamps `startedAt` **only when it is absent**, so a task answered
after an hour of `waiting` still began when it began — the gap between creation
and start is the only measure of how long work sat queued.

`setPlan` writes the list wholesale and never the status: revising a plan is not
progress through it. No previous plan is kept, because an agent that learns
better rewrites the list and nobody acts on the intentions it replaced.

`completeTask` and `failTask` both attribute their activity entry to
[`taskActor`](../../types/agent-task.ts) — the task, never the person who
dispatched it. That is what a reader sees as *Researcher · Gabriel Curtis · Q3
competitive scan*: the persona, who asked, and this task's own title.

## Promoted before a second caller exists

`requireTask` has six callers and `moveTo` six. `lifecycle.ts` has none inside
this capability, and is promoted anyway, because a procedure the door must not
expose has nowhere else to live: an `api/<verb>/` directory for it would fail the
correspondence lint by naming a function nobody registers.
