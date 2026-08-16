# API: `list`

The project's tasks, narrowed by status or by persona.

Registered as `api.capabilities.agentTasks.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope, filter)
├── query("agentTasks").withIndex("by_persona" | "by_project_status")   list.ts
└── asSummary(row)                                                      ../shared/as-task.ts
```

## Each narrowing is one indexed range

That is why there are two indexes. `by_project_status` answers "what is running"
— the question somebody asks about work they are waiting on — and `by_persona`
answers "what has this one done".

Asked together, the index does the coarser half and the finer half is a predicate
over what came back. A third index would earn nothing over the size either range
already has.

## Summaries, not tasks

The prompt, the plan, and the result are left behind. A directory of tasks is the
cheapest question in the capability, and carrying every deliverable's blocks to
answer it would make it the most expensive.
