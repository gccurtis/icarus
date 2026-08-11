# SESSION — ephemeral project presence

SESSION tracks **who is live in a project right now, and where** — one presence
record per user per project, carrying their current document focus and caret /
selection position. It is an observer layer that feeds "who's here" and live-cursor
features and folds into the project [activity](activity/README.md) signal; it holds
no authority of its own.

> **Not the login session.** This capability is unrelated to the `to_session`
> **auth cookie**, which belongs to [access](access.md). That cookie decides *who
> you are*; a SESSION row records *that you are presently active in a project and
> what you are looking at*. They share the word "session" and nothing else.

- **Domain** — [`core/capability/session`](../../../core/capability/session/session.go).
  The `Sessions` service owns presence records, a background sweeper, and an
  activity queue, and defines the `Store` interface it depends on.
- **Application handlers** —
  [`core/handlers/session`](../../../core/handlers/session/session.go). Thin
  endpoints over the selected project (`ctx.Project.ID`), never a path parameter.

## The model

```go
type Session struct {
	ProjectID, UserID, SessionID string
	UserName, UserEmail          string   // identity snapshot for the presence UI
	CurrentDocumentID            string
	CaretAtomID                  string
	CaretOffset                  int
	SelectionStartAtomID         string
	SelectionStartOffset         int
	SelectionEndAtomID           string
	SelectionEndOffset           int
	StartedAt, LastActivityAt    time.Time
}
```

"Ephemeral" is the key word. A session is created on demand, its
`LastActivityAt` is bumped as the user acts, and a background **sweeper** deletes
any session idle past a stale timeout (default **15 minutes**), so presence
self-expires without the client having to clean up. `List` additionally hides
rows already past the cutoff but not yet swept, so a reader never sees stale
presence.

The `Sessions` service runs two goroutines started at construction: a **consumer**
that drains a buffered activity `queue` (bumping `LastActivityAt`) and a periodic
**sweeper** (`SweepInterval` default 60s, `QueueSize` default 256). `Stop`
shuts both down; [`wiring`](../../../core/wiring/wiring.go) defers it at process
shutdown.

## Lifecycle and HTTP surface

All routes are **project-scoped** and register only when a session service is
wired (`opts.Sessions != nil`). The project is always the caller's selected
project.

| Method & path | Handler | Purpose |
|---|---|---|
| `POST /sessions` | `Start` | Open (or re-activate) the caller's presence — an upsert. Body `{sessionId?}` (generated when omitted); `UserName`/`UserEmail` come from `ctx.User`. → `200` full `Session`. |
| `PUT /sessions/current` | `Update` | Move the focus/caret/selection. Body `{currentDocumentId, caretAtomId, caretOffset, selectionStart…, selectionEnd…}`. → `200 {status:"updated"}`. |
| `DELETE /sessions/current` | `Close` | Explicitly end presence (hard delete). → `200 {status:"closed"}`. |
| `GET /sessions` | `List` | The project's active (non-stale) presence rows. → `200 {sessions:[…]}`. |

`Start` is an upsert: calling it again re-activates an existing row rather than
duplicating it. `Update` and `Start` both refresh `LastActivityAt`, which is what
keeps a user counted as present.

### Presence-refreshing middleware

Presence should not decay while a user is actively working, even if they never
call the session endpoints again. A `sessionActivity` middleware on the
project-scoped group handles that: on any successful (2xx) `POST`/`PUT`/`DELETE`/
`PATCH` it reads the request's resolved `access.Context` and pushes a `request`
event, which the consumer turns into a `LastActivityAt` bump. So editing a
document keeps a user present without repolling `/sessions`. The middleware lives
in the **transport** layer, not this capability: reading the gate's
`access.Context` would otherwise force the session capability to import `access`,
which the layering forbids (see record 0059).

## Identity enrichment

Presence is part of a broader identity-enrichment pass (records 0055–0057) that
gives the cockpit real profile data instead of mock identities:

- **Sessions** carry `UserName` and `UserEmail`, snapshotted from `ctx.User` at
  `Start`, so the presence UI can resolve a face to a name and email.
- **[Documents](documents/README.md)** carry `creatorId` / `creatorName` from the
  acting user (records 0055).
- **[Activity](activity/README.md)** events embed an actor snapshot `{id, name}`.
- **[Access](access.md)** exposes a richer peer profile at `GET /users/:userID`
  (`{id, kind, name, email?, role, description, createdAt}`) for a current project
  member, and `PATCH /auth/me` lets a user set their display name.

## Persistence

Presence is **durable** in the one SQLite [store](../persistence.md): the
`project_sessions` table, keyed `(project_id, user_id)` and indexed by
`(project_id, last_activity_at)` for the sweeper and listing. A `MemoryStore`
provides the same `session.Store` contract for tests.

## Status

**Wired and reachable over HTTP today** — the four `/sessions*` routes, the
presence-refreshing middleware, the sweeper, durable persistence, and the
identity fields are all live.

## Related

- [Access](access.md) — the auth session and the peer-profile projection this builds on.
- [Activity](activity/README.md) — the project event feed presence signals feed into.
- [Persistence](../persistence.md) — the `project_sessions` schema.
