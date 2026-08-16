# API: `read`

One task, opened by its own address.

Registered as `api.capabilities.agentTasks.read`, built from `projectQuery`.

## Procedure Tree

```text
read(ctx, scope, id)
├── requireTask(ctx, scope, id)   ../shared/require-task.ts
└── asTask(row)                   ../shared/as-task.ts
```

## It carries what the list does not

The prompt, the plan, and the result. This is the page where somebody asks what
the task was told to do and what came of it — and the prompt is the provenance of
everything else on the row.

The conversation is `messages.list(("task", id))` and is not read here. A task
with a long thread costs the same to open as one with none.
