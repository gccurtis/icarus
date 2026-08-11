# WORKSPACE — the opaque per-user cockpit blob

WORKSPACE stores **one user's cockpit state for one project** — which tabs are
open, how the panels are arranged, what is pinned where — so that a person's
working layout follows them from laptop to desktop. It is personal UI state, not
project content: two members of the same project have entirely independent
workspaces, and neither can see the other's.

The capability's distinguishing feature is what it refuses to do. Omega treats
the state as an **opaque JSON blob**. It validates that the payload is a bounded,
valid JSON object and stores it verbatim. It does not know what a tab is.

- **Domain and persistence contract** —
  [`core/capability/workspace`](../../../core/capability/workspace/workspace.go).
- **In-memory store** —
  [`core/capability/workspace/memory.go`](../../../core/capability/workspace/memory.go).
- **Application handlers** —
  [`core/handlers/workspace`](../../../core/handlers/workspace/workspace.go).

## The model

```go
const MaxStateBytes = 64 * 1024

type Workspace struct {
	UserID    string
	ProjectID string
	State     json.RawMessage   // opaque; the store never interprets it
	UpdatedAt time.Time
}

type Store interface {
	Workspace(userID, projectID string) (Workspace, error)
	SetWorkspace(w Workspace) error
}

type Workspaces struct{ store Store }   // the entire service struct
```

Three sentinel errors: `ErrNotFound` (nothing saved yet), `ErrTooLarge` (over
`MaxStateBytes`), and `ErrInvalid` (not a JSON object).

Note the absence of a `Scope` struct. Every other project-scoped capability takes
one and re-checks `record.ProjectID == scope.ProjectID` on by-id reads. Here the
`(userID, projectID)` pair **is** the primary key, so there is no by-id lookup
that could return another project's row and therefore nothing to re-scope — the
key does the work the check would have done. The service is otherwise the plain
stateless-over-a-`Store` shape of the
[meta-model](../runtime-model.md#6-phase-4--the-capability-meta-model).

## Why the backend does not model the layout

Deliberately not modelling the client's layout buys two things:

- **The cockpit evolves without a backend change.** Adding a panel type, changing
  how splits nest, or renaming a field is a client-only edit. No migration, no
  schema, no coordinated deploy. A capability that parsed the layout would be
  dragged along by every UI iteration.
- **The backend gains nothing by understanding it.** No server-side feature reads
  a tab arrangement; no other capability derives from it. Parsing would be cost
  without a consumer.

The cost accepted in exchange is that the server can neither validate nor merge
this data. Two devices saving concurrently do not merge — **last write wins**, and
the loser's arrangement is gone. For personal, easily-recreated UI state that is
the correct trade: a merge would need a layout model, which is exactly what is
being avoided, to protect state a user can restore by dragging a panel.

Validation is therefore only structural:

- **Size** — over `MaxStateBytes` (64 KiB) is `ErrTooLarge`, checked before
  parsing so an oversized body is never walked.
- **Shape** — `json.Valid` plus a first-non-whitespace-byte check for `{`, so
  arrays, strings, and numbers are rejected. An object is required because the
  read endpoint spreads the stored keys at the top level and adds `updatedAt`
  alongside them; a non-object could not carry that field.

`Set` also copies the incoming bytes (`append(json.RawMessage(nil), state...)`)
rather than retaining the caller's buffer, so a reused decode buffer cannot mutate
stored state.

## Operations

| Method | Behaviour |
|---|---|
| `Get(userID, projectID)` | The stored workspace, or `ErrNotFound`. |
| `Set(userID, projectID, state, now)` | Validate size then shape, copy, and replace the whole state. Last write wins. |

Two methods, no partial update: `Set` always replaces the entire blob. Patching
would require understanding the interior, which is the thing being declined.

`Set` takes `now` as a parameter rather than reading a clock — the handler passes
its own injectable `now`, which keeps both the service and the handler testable
without a package-level clock.

## HTTP surface

Two routes on the **project-scoped** group, registered only when a workspace
service is wired. Both derive the user from `ctx.User.ID` and the project from
`ctx.Project.ID`, so a caller can only ever reach their own state in their own
selected project.

| Method & path | Handler | Purpose |
|---|---|---|
| `GET /workspace` | `Get` | The stored object spread at top level with an added `updatedAt`. Nothing saved → `200 {"updatedAt": null}`. |
| `PUT /workspace` | `Put` | Replace the caller's whole state. → `200 {updatedAt}` |

**Any project member may save their own workspace**, including a read-only one.
There is no write-role gate, because this is not project content — the same
reasoning that lets any member set their own default [persona](persona.md).

Error mapping: over-size → `413`, invalid JSON or non-object → `400`, store
failure → `500`. The read path is forgiving by design: if stored state somehow
fails to unmarshal, the handler falls back to an empty object plus `updatedAt`
rather than failing the request, so a corrupted blob costs a user their layout but
never their access to the cockpit.

## Persistence

One table in the shared SQLite [store](../persistence.md):

- **`workspaces`** — `(user_id, project_id)` primary key, `state` stored as TEXT,
  `updated_at`. The upsert is exactly the last-write-wins semantics the service
  promises.

A `MemoryStore` (with a compile-time `var _ Store` assertion) provides the same
contract for tests and single-process runs.

## Status

**Wired and reachable over HTTP today.** `wiring.Run` constructs it with
`workspace.New(store)` — no configuration, no options — and hands it to the
transport for the two scoped routes.

## Related

- [Access](access.md) — establishes the user and project every key is built from.
- [Session](session.md) — the *other* per-user-per-project state, and unlike this one, ephemeral.
- [Persistence](../persistence.md) — the `workspaces` schema.
