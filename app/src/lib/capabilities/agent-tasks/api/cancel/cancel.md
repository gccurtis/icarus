# API: `cancel`

Stops a task somebody no longer wants finished.

Registered as `api.capabilities.agentTasks.cancel`, built from `projectMutation`.

## Procedure Tree

```text
cancel(ctx, scope, id)
├── requireTask(ctx, scope, id)         ../shared/require-task.ts
├── moveTo(ctx, task, "cancelled")      ../shared/transition.ts
└── record(ctx, scope, "cancelled")     ../../../activity/api/shared/record.ts
```

## It writes no error

Which is the whole point of `cancelled` being its own state. Somebody changing
their mind is not a failure, and folding the two together makes a failure rate a
measure of how often people do.

## The actor is the person

Every other end to a run is the task's own act. This one is done *to* it, and a
feed saying the agent cancelled itself would hide who actually stopped it — which
is the one thing anybody reading that entry wants to know.

## What it leaves alone

The plan and whatever result had been written stand. A task cancelled halfway
through did the work it did, and clearing that would remove the only record of
how far it got.

A task that has already stopped is refused as `already-finished` rather than
re-ended, so a cancel arriving just after a completion cannot rewrite how the
task finished.
