# API: `read`

One thread, for opening it by its own address rather than through a list.

Registered as `api.capabilities.personaThreads.read`, built from `projectQuery`.

## Procedure Tree

```text
read(ctx, scope, id)
├── requireThread(ctx, scope, id)     ../shared/require-thread.ts
└── asThread(row)                     ../shared/as-thread.ts
```

## It returns what `list` returns per row

There is no heavier half to withhold: the substance of a chat is its messages,
and those are a separate read against a separate table.

## Any member may read it

There is no check beyond the project. Threads are project content rather than
private correspondence, and a chat that turned into a task is part of why the
task exists.
