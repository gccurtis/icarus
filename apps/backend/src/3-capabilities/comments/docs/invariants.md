# Comments invariants and limits

## Admission and ownership

- Body, request ID, target kind/ID, Comment ID, and trusted actor ID are trimmed,
  non-empty, and bounded where applicable.
- Public command objects use exact keys and cannot select attribution.
- `subTarget`, when present, has a JSON object root, canonical sorted object
  keys, JSON-compatible nested values, no cycles/non-finite numbers, and a
  bounded serialized size.
- Comments never interprets the sub-target or verifies target existence.
- Mention handles are server-derived, normalized, de-duplicated, and bounded.

## Lifecycle and attribution

- New Comments are open; only resolve and reopen switch state.
- `createdBy` and `createdAt` never change.
- Every state-changing accepted mutation updates `updatedBy` and `updatedAt`
  from trusted composition attribution.
- A matching-state resolve/reopen leaves the Comment unchanged but records its
  own replay receipt.
- Delete is soft. Deleted rows are absent from get/list and reject new commands.

## Replay, persistence, and Activity

- A request ID is project-global within Comments.
- Equal canonical replay returns the stored result; divergent reuse is a
  conflict.
- Every state-changing accepted command atomically commits current state,
  receipt, and exactly one self-contained source Activity row.
- Matching-state no-ops commit a receipt without an Activity row.
- Activity failure cannot roll back accepted Comment state.
- Activity is marked published only after it accepts the stable transaction ID.
- Activity metadata never contains the body, raw handles, or sub-target.
- Project ID, not user ID, determines table names and isolation.

## Query behavior

- Target lists use exact resource kind/ID matching and exclude deleted rows.
- Ordering is ascending `(createdAt, id)`.
- Cursors are opaque and bound to target kind/ID plus optional state.
- Default page size is 50 and maximum is 200.

## Explicit non-goals

- No threads, replies, body revision history, or undo/redo.
- No Rich Text body or Rich Content identity dependency.
- No resource existence, anchor freshness, or reattachment system.
- No verified user identity for mentions and no notification delivery.
- No cross-database transaction with Activity; the Comments outbox is recovery
  authority.
