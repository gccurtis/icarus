# Messages Types

Lives at `types/types.md`.

`types/` holds the canonical model. There are no stored row shapes because there
is no table — see [why](../overview.md#why-there-is-no-table).

Written validator-first, `v.object(…)` then `Infer<typeof …>`, except where the
inherited recursion in `ContentBlock` forces the type to be stated by hand.

## Files

| File | Holds |
| --- | --- |
| [`message.ts`](message.ts) | `Message`, `MessageFields`, `MessageRole`, `MessageState`, and `message()` |

## `message()` is a constructor, not a checker

It is the one piece of behaviour here, and it is a **constructor** rather than a
validation function because being the only way to build a `Message` is what makes
the two invariants unavoidable. A checker can be skipped; a constructor is the
door.

Both invariants are ones a Convex validator has no way to express:

- **A prompt must name its author.** A validator sees one field at a time and
  cannot say "required, but only when `role` is `prompt`".
- **`state` is derived from `error`.** A validator can say `state` is one of
  three literals. It cannot say which one, given another field's value.

`MessageFields` is what a caller passes, and it deliberately has **no `state`**.
It carries `error` and an optional `streaming` flag instead, and `message()`
resolves those into a state — `error` winning over `streaming`, because a failure
has already happened. A caller who could pass `state` could pass one contradicting
its own `error`, which is the disagreement the derivation exists to prevent.

`labels` are canonicalized on the way through: trimmed and lowercased, so
`Pinned` and `pinned` are one label rather than two that shadow each other by
write order.

## It throws `MessagesError`, not `Error`

`message()` is called inside **another capability's** mutation — a research
thread, an agent task, a persona thread — so the throw crosses the wire whatever
file raised it.

Convex serializes a `ConvexError`'s payload to the caller and redacts everything
else to an opaque server fault. A plain `Error` would therefore reach the author
as "the server broke", with the turn they were sending lost and no reason given.
[`errors.ts`](../errors.ts) is at the capability root rather than here because a
consumer catching one is using the public contract.

## `Message` is stated, not purely inferred

`blocks` is `ContentBlock[]` in the type and `v.array(blockValidator)` in the
validator, and those differ in exactly one place: a table cell's blocks are
`v.any()`, because [the recursion is real and a validator is a
value](../../content/types/types.md#where-the-validator-and-the-type-disagree).

The type is `Omit<Infer<…>, "blocks"> & { blocks: ContentBlock[] }` so the
inherited compromise is visible here rather than silently widening a message's
body to `any[]`.

## What is absent, and why

| Absent | Because |
| --- | --- |
| `projectId`, `thread` | Both belonged to a table. The owner row *is* the thread |
| `ThreadRef` | Same — the link stops needing to exist |
| `ToolCall` | A client concern. Nothing here models it, and nothing should |
| `Attachment` | An attachment is a `ResourceRef`; there was no type to write |
| `mentions[]` | A mention is a `Mark` inside the blocks, where it shifts with the text |
| `previousMessageId` | An array is already ordered |
| `revision` | Append-only. Changing a conversation is branching |

**Ordering is array position, not `sentAt`.** The owner appends, so order is the
array's; `sentAt` exists only to display a time and nothing sequences on it.
