# API: `list`

The discussion on one thing, or across the whole project.

Registered as `api.capabilities.comments.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope, target?)
├── by_target range, or by_project when no target   list.ts
└── by_thread range per thread → Thread[]           list.ts
```

## Two ranges, because they answer different questions

With a target it is what an editor opens with — every remark on this document — and
`by_target` makes that one indexed range rather than a scan of everything the
project has ever discussed. Without one it is a review queue.

Both lead with `projectId`, so neither can reach another project's rows.

## Comments are read per thread

Each is an exact `(projectId, threadId)` range. The alternative — one project-wide
read filtered in memory — costs more the moment a project holds more comments than
the thing being opened holds threads, which is the ordinary case for a document
somebody is reading.

They come back with their thread rather than on request, because a thread without
its replies renders nothing: the anchor and the resolved state are not what anybody
reads.

## Resolved threads are returned

Hiding them is a decision the surface makes — a document view hides them, a review
queue shows them — and filtering here would take that choice away while leaving the
rows reachable by id anyway.

## No ordering

The index's own creation order. Recency and anchor position are both a sort over a
list the caller already holds, and a second index buys nothing until one target's
threads stop fitting in a read.
