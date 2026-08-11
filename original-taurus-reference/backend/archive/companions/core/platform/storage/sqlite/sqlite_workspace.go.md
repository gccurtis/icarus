# sqlite_workspace.go

Per-user workspace state: the UI's own persisted scratch state — open panels,
sidebar width, whatever the client wants remembered — stored as one opaque JSON
blob per user × project. This is not a separate store; every file in the package
shares one `*Store` and one connection, and the split is organizational,
mirroring the capability boundaries in `core/capability`.

The whole point is that the server does not model this state. It is stored and
returned as `json.RawMessage`, never unmarshalled, never validated, never merged.
The client owns the shape and can evolve it without a schema migration or a
server change. The `workspaces` table is keyed on `(user_id, project_id)`, so a
user's arrangement of one project is independent of their arrangement of
another, and of every other user's.

Concurrency is deliberately trivial: **last write wins.** `SetWorkspace` replaces
the blob wholesale — there is no revision, no compare-and-swap, no merge. Two
tabs writing at once means one of them loses its state, which is the accepted
cost for state that is a convenience rather than a record. Nothing here is
content; anything that must not be lost belongs in a real capability store.

## Code breakdown

### File header and imports

States the shared-`*Store` invariant, then imports `database/sql`,
`encoding/json` (for `RawMessage` — the pass-through, not a decode), `errors`,
`time`, and `core/capability/workspace` for the type and its `ErrNotFound`.

### Workspace — read one user's state for one project

Selects `state` and `updated_at` for the `(user_id, project_id)` pair. A missing
row is `workspace.ErrNotFound` rather than an empty workspace, so the caller can
tell "never saved anything" from "saved something empty" and apply its own
defaults. The stored JSON is wrapped as `json.RawMessage` and the ids are echoed
back from the arguments — they are the key, so there is no reason to re-read
them. `updated_at` is parsed with `sortableTimeLayout`, matching how
`SetWorkspace` wrote it.

### SetWorkspace — upsert the blob

A single statement: insert, or on a `(user_id, project_id)` conflict overwrite
`state` and `updated_at` from the excluded row.

```sql
ON CONFLICT(user_id, project_id) DO UPDATE SET
    state      = excluded.state,
    updated_at = excluded.updated_at
```

That upsert is the last-write-wins rule in one place — first save and every
subsequent save take the same path, so there is no create-versus-update branch
for a caller to get wrong. The timestamp is written with `sortableTime` so the
stored text sorts chronologically, consistent with the rest of the schema.
