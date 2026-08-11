# Per-user workspace state (backend-outstanding Phase F)

A user's open tabs and panel geometry follow them across devices, per project.
Omega stores the state as an **opaque JSON blob** — it validates only the size
and that the payload is a JSON object, and returns it verbatim, so the cockpit
can evolve the interior shape without a backend change.

## Capability (`core/capability/workspace`)

- **`Workspace{ UserID, ProjectID, State, UpdatedAt }`** — `State` is
  `json.RawMessage` the store never interprets.
- **`Store`**: `Workspace(userID, projectID)` / `SetWorkspace(w)` — globally
  unique names; `MemoryStore` implements it for tests.
- **`Workspaces`** service: `Get` returns the saved workspace or `ErrNotFound`;
  `Set` validates the state is a bounded (**≤ 64 KiB**), valid **JSON object** and
  stores it verbatim with the caller-supplied timestamp. Keyed per user × per
  project; last write wins.

## Persistence

`workspaces(user_id, project_id, state, updated_at, PRIMARY KEY(user_id,
project_id))`; `SetWorkspace` upserts via `ON CONFLICT(user_id, project_id)`.
`var _ workspace.Store = (*Store)(nil)`.

## Endpoints (project-scoped; user + project from the session)

- **`GET /workspace`** → `200` the stored state spread at top level with an added
  `updatedAt`, or `{ "updatedAt": null }` when the user has saved nothing.
- **`PUT /workspace`** `{ ...state }` → `200 { updatedAt }` (whole-state replace).
  A non-object body is `400`; an oversized state is `413`. Any member may save
  their own workspace — it is personal UI state, not project content, so it is
  not gated on the write role.

## Tests

- Unit (`core/capability/workspace`): set then get; unset is `ErrNotFound`;
  isolated per user and per project; last write wins; oversized rejected;
  non-object (array/scalar/invalid) rejected.
- Dev-test (`dev-test/workspace`, free): GET before save returns `updatedAt`
  null; PUT then GET round-trips verbatim with a timestamp; a second PUT replaces
  wholesale; a non-object is `400` and an oversized state is `413`; the same user
  in another project and a second user in their own project each see an empty
  workspace.

## Settled

- Opaque JSON blob, validated only for size + object-ness, returned verbatim. ✓
- Keyed per user × per project; last write wins; server `updatedAt`. ✓
- New capability + memory store + sqlite table + handlers + routes + wiring. ✓
