# API: `dispatch`

Hands a goal to an agent, and returns the task's id.

Registered as `api.capabilities.agentTasks.dispatch`, built from
`projectMutation`.

## Procedure Tree

```text
dispatch(ctx, scope, origin, input)
├── taskTitle(input.title)                     ../../types/agent-task.ts
├── taskPrompt(input.prompt)                   ../../types/agent-task.ts
├── requireOrigin(ctx, scope, origin)          require-origin.ts
│   └── requireTask(ctx, scope, parent)        ../shared/require-task.ts
├── requirePersona(ctx, scope, personaId)      ../../../personas/api/shared/require-persona.ts
├── requireBranchPoint(ctx, scope, from)       require-branch-point.ts
├── ctx.db.insert("agentTasks", { … })         dispatch.ts
└── record(ctx, scope, "dispatched")           ../../../activity/api/shared/record.ts
```

## It creates one row, and that row is the thread

Nothing is created beside it. The first turn is
[`messages.post`](../../../messages/api/post/post.md) naming this id, so a task
nobody has spoken in yet is a task with no messages rather than an empty
conversation object.

## `origin` is a parameter, and it is not always the caller

The door builds `{ kind: "user", userId }` from `ctx.scope`, so a browser cannot
claim somebody else dispatched a task. A **running task** delegating work calls
this handler directly with [`taskActor`](../../types/agent-task.ts), and the
child then records the parent rather than the person at the top of the tree.

That is what makes delegation traceable, and it is why
[`requireOrigin`](require-origin.ts) resolves the parent: an origin naming a task
nobody here can read is a tree with no root.

**Dispatching still does not make the dispatcher the actor of what the task
does.** `origin` is a record of who asked; changes the task makes carry the task.

## The prompt is stored exactly as it arrived

Trimming it would be the first rewrite, and the argument against every later one
is that there have been none. The title is trimmed, because it is a label; a
blank one is refused, because it is also the `detail` half of every actor label
the task produces.

## It begins in `draft`

`_creationTime` says when the task came into existence and `startedAt` says when
a runner picked it up. Inserting it as `running` would erase the distinction and
make a queue invisible.
