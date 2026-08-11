# PRESENCE — who has this document open right now

PRESENCE answers exactly one question: **which users currently have a given
document open?** It backs the stack of collaborator faces on a document and
nothing else. An entry lives only while its user keeps heartbeating, so a browser
that closes uncleanly expires on its own rather than leaving a phantom "online"
record behind.

> **Genuinely stateful — one of three.** Like [notification](notification.md),
> this service *is* its own store: an in-memory map under a mutex, no `Store`
> port, no `memory.go`, no SQLite table. See the
> [runtime model §6](../runtime-model.md#6-phase-4--the-capability-meta-model).

- **Domain and state** —
  [`core/capability/presence`](../../../core/capability/presence/presence.go).
  One file, three methods.
- **Application handlers** —
  [`core/handlers/collaboration`](../../../core/handlers/collaboration/collaboration.go).
  Note there is **no `core/handlers/presence`**: presence is served as part of the
  document collaboration projection.

## Three different things are called "session" or "presence"

This is the main confusion risk in the codebase, and the three are unrelated:

| | Owner | Grain | Storage | Lifetime |
|---|---|---|---|---|
| **Auth session** | [access](access.md) | one `to_session` cookie → user + selected project | SQLite, server-side | until logout or `access.session_ttl` |
| **Project session** | [session](session.md) | one row per **user × project**, with caret/selection | SQLite `project_sessions` + a sweeper goroutine and activity queue | ~15 min idle, swept in the background |
| **Document presence** | **this capability** | one entry per **user × document** | in-memory map, lost on restart | 30 s without a heartbeat |

The auth session decides *who you are*. The [session](session.md) capability
records *that you are active in a project and where your caret is*, durably, and
feeds the [activity](activity/README.md) feed. Presence records only *that you
have this document open right now*, disposably. They share vocabulary and nothing
else — no capability here reads either of the others.

## The model

```go
const (
	DefaultTTL   = 30 * time.Second   // how long an entry survives without a heartbeat
	MaxOpenUsers = 20                 // bound on one document's returned stack
)

type Entry struct {
	UserID string
	Name   string
	Access string        // the caller's project role, snapshotted at Touch
	SeenAt time.Time
}

type Presence struct {
	mu    sync.Mutex
	ttl   time.Duration
	now   func() time.Time
	byDoc map[string]map[string]Entry   // documentID -> userID -> Entry
}
```

`New(ttl)` falls back to `DefaultTTL` when given a non-positive duration.

Note what the struct does *not* carry: there is no `Scope`, and `byDoc` is keyed
by document id alone, not by `(project, document)`. Project scoping is enforced
one layer up — the handler loads the document under the authorized
`ctx.Project.ID` before touching presence, so a document id that reaches this map
has already been proven to belong to the caller's project.

## Operations

| Method | Behaviour |
|---|---|
| `Touch(documentID, userID, name, access)` | Record or refresh an entry, stamping `SeenAt` from the injected clock. Creates the per-document map on first use. |
| `Clear(documentID, userID)` | Remove one user's entry; idempotent. Deletes the per-document map when it empties. |
| `Open(documentID) []Entry` | The live stack: entries whose `SeenAt` is within the TTL, **newest-seen first** (ties broken by user id for determinism), truncated to `MaxOpenUsers`. `nil` for a document nobody has touched. |

## Pruning is lazy — no background goroutine

Expiry happens **only inside `Open`**. Reading a document's presence walks that
document's map, deletes every entry older than `now - ttl` as a side effect, and
drops the document's map entirely if it empties. There is no ticker, no sweeper,
and nothing to join to the process lifecycle — which is why this capability, unlike
[session](session.md), needs no `Stop`.

The trade-off is explicit: a document that is written to and then never read again
keeps its stale entries resident until someone calls `Open` on it. That is bounded
by the number of distinct documents touched since boot, each holding at most a
handful of small structs, and it costs nothing to correctness because a stale
entry can never be *returned* — the TTL filter runs before the result is built.
For the current single-process deployment that is the right trade: no goroutine
to leak and no shutdown ordering to get wrong. Project-level and subcell-safe
presence remain target work.

Restart drops all presence, which is correct rather than lossy — every client
re-heartbeats within `DefaultTTL`, so the stack repopulates in under 30 seconds
with no reconciliation logic.

## HTTP surface

All three routes are **project-scoped** and register together, only when both a
presence tracker and an [activity](activity/README.md) service are wired
(`opts.Presence != nil && opts.Activity != nil`).

| Method & path | Handler | Purpose |
|---|---|---|
| `GET /documents/:documentID/collaboration` | `Get` | The document's collaboration projection: `lastEdit` (durable attribution from the activity feed, falling back to creation metadata) plus `openUsers` from this capability. |
| `PUT /documents/:documentID/presence` | `PutPresence` | Heartbeat. Confirms the document exists in the selected project (→ `404` otherwise), then `Touch`es with `ctx.User.ID`, `ctx.User.Name`, and `ctx.Role`. → `204` |
| `DELETE /documents/:documentID/presence` | `DeletePresence` | Clear the caller's own entry. Idempotent, no document lookup. → `204` |

**Any project member may signal presence**, including a read-only one — the role
is recorded as the entry's `Access` so the UI can badge a viewer differently from
an editor, not used as a gate.

The `Access` and `Name` fields are snapshots taken at `Touch`. A role changed
mid-session shows its old value until the next heartbeat, at most 30 seconds
later; for a decorative badge that staleness is not worth a lookup per read.

## Status

**Wired and reachable over HTTP today.** `wiring.Run` constructs it with
`presence.New(presence.DefaultTTL)` and hands it to the transport; the TTL is not
configurable.

## Related

- [Session](session.md) — the *durable* project-level presence this is often confused with.
- [Access](access.md) — the auth session, and the source of `ctx.User` / `ctx.Role`.
- [Documents](documents/README.md) — the aggregate presence is keyed against.
- [Notification](notification.md) — the other in-memory-by-design capability.
