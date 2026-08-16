# API: `post`

Appends one turn to a thread, and returns its id.

Registered as `api.capabilities.messages.post`, built from `projectMutation`.

## Procedure Tree

```text
post(ctx, scope, draft)
├── messageAuthor(draft.role, draft.author)     ../../types/message.ts
└── ctx.db.insert("messages", { thread, role })  post.ts
```

## It creates no thread, and that is not an omission

A research thread, an agent task, and a persona thread each *are* threads, so
there is nothing to create first and no pointer to write back. The draft names
which thread it belongs to and the index does the rest.

Nothing here checks that the thread exists yet — none of the three tables does.
When they arrive this proves the thread is in the caller's project, which is the
one check the model asks for and the only one it can.

## The author rule lives here

`v.optional(actorValidator)` says an author may be absent; it cannot say that
absence is legal only on a response, because that is a constraint between two
fields. So [`messageAuthor`](../../types/message.ts) is called before anything is
written, and every path into the table goes through it.

Through the door the unauthored case never arises: the actor is built from
`ctx.scope`, and a caller at the door is never the thread's own responder.

## `streaming` opens a turn before it has content

A responder producing a turn writes the row first and
[`finish`](../finish/finish.md)es it when it is done. That is one append arriving
in two parts rather than an edit — nothing else ever writes the row, and a turn
that never finishes stays visibly `streaming` instead of appearing to be a short
answer.
