# API: `list`

One thread's turns, oldest first.

Registered as `api.capabilities.messages.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope, thread)
└── ctx.db.query("messages").withIndex("by_thread")   list.ts
```

## The index is the link

`by_thread(("research", id))` is one indexed read: no thread row to fetch first,
no pointer on either side, nothing to keep in sync. That is the whole reason
neither a thread nor a message stores the other's id.

**The discriminant is half the key.** Three tables mint ids into one column and
two of them may hand out the same one, so a read on the id alone would merge two
conversations that have nothing to do with each other.

## `projectId` leads, and decides

The message's own column is what scopes the read, so this never joins upward to a
thread row to find out whether it was allowed to look. A check that has to join
upward is a check that will eventually forget to — and a thread in another
project simply comes back empty rather than being told apart from an empty one.

## No ordering to do

Every row in the range shares all three index fields, so the range is already
`_creationTime` order. That is what append-only buys: no rank column, no sort,
and no position for two writers to fight over.

Unpaged today. A long conversation will need `.paginate()`, and oldest-first
makes that the awkward direction — a chat wants the *end* of the range — so this
is the read to revisit when threads outgrow one fetch, not `activity`'s.
