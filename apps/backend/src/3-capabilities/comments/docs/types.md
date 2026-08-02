# Comments type reference

Canonical definitions are in [`domain/model.ts`](../domain/model.ts).

## Comment and target

```ts
interface CommentTarget {
  resourceKind: string;
  resourceId: string;
  subTarget?: JsonObject;
}

interface Comment {
  id: string;
  body: string;
  mentions: string[];
  target: CommentTarget;
  state: "open" | "resolved";
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
```

`JsonObject` is a recursively JSON-compatible map. Arrays and scalar values are
valid below its root. `CommentAttribution` contains trusted `actorId` and
`origin: user | agent | automation | system`; it is a composition dependency,
not part of a public command.

## Commands and results

| Command | Fields beyond `type` and `requestId` | Result |
| --- | --- | --- |
| `comment.create` | `body`, `target` | `comment.created` plus Comment |
| `comment.update` | `commentId`, `body` | `comment.updated` plus Comment |
| `comment.resolve` | `commentId` | `comment.resolved` plus Comment |
| `comment.reopen` | `commentId` | `comment.reopened` plus Comment |
| `comment.delete` | `commentId` | `comment.deleted` plus `commentId` |

Every request ID is project-global within Comments. Equal canonical replay
returns the stored `CommentCommandResult`; divergent reuse raises
`CommentIdempotencyMismatchError`.

## Queries and results

| Query | Input | Result |
| --- | --- | --- |
| `comment.get` | `commentId` | `comment.get` plus Comment; missing/deleted is not found |
| `comment.listByTarget` | target kind/ID, optional state/cursor/limit | `comment.listByTarget` plus `CommentPage` |

`CommentPage` lists ascending `(createdAt, id)` and may provide an opaque
`nextCursor`. A cursor is bound to its resource kind, resource ID, and optional
state filter.

## Persistence and integration types

- `CommentCommandReceipt` stores request ID, canonical digest, original result,
  and acceptance time.
- `CommentActivityTransaction` is a self-contained source-outbox record. It
  includes target IDs, resulting state, mention count, trusted attribution,
  and time—but never body, handles, or sub-target.
- `CommentStore` is the durable port for reads, atomic commits, receipts, and
  outbox recovery.
- `CommentActivityPublisher` accepts one source record and is implemented by
  composition over Activity.
- `CommentsCapability` exposes `command`, `query`, and
  `publishPendingActivity`.

## Error family

| Error | Meaning | HTTP status |
| --- | --- | --- |
| `CommentWireError` | Malformed or unexpected public payload field. | 400 |
| `CommentValidationError` | Invalid or over-limit domain value. | 400 |
| `InvalidCommentCursorError` | Malformed or filter-mismatched cursor. | 400 |
| `CommentNotFoundError` | Missing or soft-deleted Comment. | 404 |
| `CommentIdempotencyMismatchError` | Request ID reused for changed content. | 409 |

Unexpected errors return a non-sensitive 500 response and are logged without
body or sub-target data.
