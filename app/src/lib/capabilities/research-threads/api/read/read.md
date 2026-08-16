# API: `read`

One thread, opened by its own address.

Registered as `api.capabilities.researchThreads.read`, built from `projectQuery`.

## Procedure Tree

```text
read(ctx, scope, id)
├── requireThread(ctx, scope, id)   ../shared/require-thread.ts
└── asThread(thread)                ../shared/as-thread.ts
```

## It returns what `list` returns per row

There is no heavier half to withhold, because the substance of a thread is its
messages and those are `messages.list(("research", id))` — a separate read
against a separate table. What this buys is opening a thread from a link without
listing the project first.

## Not found, never forbidden

A thread in another project answers exactly as one that never existed. Telling
them apart would confirm that a conversation about something is happening, which
is most of what a thread's title gives away.
