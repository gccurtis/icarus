# NOTIFICATION — ephemeral per-user toasts

NOTIFICATION carries **transient, per-user, project-scoped signals** — "your task
finished", "the sync failed" — from a background worker to whichever browser tab
that user next polls. A toast is a nudge, not a record: nothing downstream reads
one, and no other capability derives state from one.

> **Genuinely stateful — one of three.** Almost every capability is a stateless
> service over an injected `Store`. This one is not: the `Notifications` service
> **is** its own store. There is no `Store` port, no `memory.go`, and no SQLite
> table. See the [runtime model §6](../runtime-model.md#6-phase-4--the-capability-meta-model).

- **Domain and state** —
  [`core/capability/notification`](../../../core/capability/notification/notification.go).
  The whole capability is one file: the value types, the queues, and the two
  methods that move toasts through them.
- **Application handler** —
  [`core/handlers/notification`](../../../core/handlers/notification/notification.go).
  A single endpoint that drains the caller's queue for the selected project.

## The model

```go
type Level string                        // closed severity vocabulary
const (
	LevelInfo    Level = "info"
	LevelSuccess Level = "success"
	LevelWarning Level = "warning"
	LevelError   Level = "error"
)

type Toast struct {                      // one message addressed to one user
	ID        string                     // assigned by Push
	Level     Level
	Title     string                     // clamped to 200 bytes
	Body      string                     // clamped to 2000 bytes
	ProjectID string
	CreatedAt time.Time                  // assigned by Push
}

type queueKey struct{ projectID, userID string }

type Notifications struct {              // the service IS the store
	mu     sync.Mutex
	queues map[queueKey][]Toast
	now    func() time.Time
}
```

`queueKey` is the important detail: a user who belongs to several projects keeps
a **separate queue per project**, so draining the selected project can never
deliver another project's toasts. That is the same project-boundary property
every other capability gets from a `ProjectID` column, expressed as a map key.

## Why in-memory is the right call, not a gap

A toast is fire-and-forget by contract. If the process restarts before a user
drains their queue, those toasts are gone — and that is **intended**, not a
durability shortfall:

- The *fact* a toast reports is already durable elsewhere. A settled agent task
  is a row in the agent task store; the toast is only a hint to go look. Losing
  the hint loses no information.
- A durable toast would need delivery tracking, expiry, and a read-state column —
  real schema and real sweep cost — to deliver a message whose value expires in
  seconds anyway.
- Nothing reads a toast programmatically. Persisting it would create a second,
  staler copy of state the system already owns.

The consequence accepted in exchange: toasts do not survive a restart, and in a
multi-process deployment a toast is only visible to the process that queued it.
Omega is a single process today, so the second point costs nothing in the current
deployment. Subcell-safe live delivery remains completion work.

## Bounded queues and drain-on-read

Two rules keep an unbounded producer from outgrowing memory:

**Bounded.** `maxPerUser = 100`. `Push` appends, and if the queue exceeds the
bound it reslices to the newest 100 — **the oldest toast is dropped first**, on
the reasoning that a stale "task finished" matters less than a fresh one. Title
and body are clamped (200 / 2000 bytes) on a UTF-8 rune boundary, so a multibyte
character is never cut in half. An unknown `Level` defaults to `info`, and an
empty `userID` is ignored outright — a task with no known requester cannot
accumulate undeliverable toasts.

**Drain-on-read.** `Drain(projectID, userID)` returns the whole queue oldest-first
and **deletes the map entry** in the same critical section. Delivery is exactly
once: a second drain returns an empty (non-nil) slice. There is no read cursor,
no acknowledgement round trip, and no per-toast state to sweep — a delivered
toast simply ceases to exist. Both methods hold `mu` for their whole body, so
concurrent producers (job workers) and consumers (HTTP) are safe.

## Ports, producers, and decoupling

This capability declares **no ports at all** — it imports nothing but the standard
library, which is why it can be a leaf despite being stateful. The coupling runs
the other way:

- The **producer** is the [agent](agents/README.md) capability. `Workflows`
  declares its own narrow `Notifier` port
  (`Push(userID string, toast notification.Toast)`) in
  [`core/capability/agent/workflow.go`](../../../core/capability/agent/workflow.go),
  and `*notification.Notifications` satisfies it **directly, with no wiring
  adapter**, because the method already matches. A nil `Notifier` disables toasts
  entirely. `settledToast` maps a task outcome onto a level: completed →
  `success`, partial → `warning`, failed → `error`; a task that merely awaits
  input produces no toast.
- The **consumer** is the drain endpoint. `agent` importing `notification` for the
  `Toast` value type is one of the sanctioned composition-tier imports noted in
  the runtime model.

`wiring.Run` builds it with a bare `notification.New()` — no store, no config —
then hands the same pointer to the agent workflows and to the transport.

## HTTP surface

One route, on the **project-scoped** group, registered only when a notifier is
wired (`opts.Notifications != nil`).

| Method & path | Handler | Purpose |
|---|---|---|
| `GET /notifications` | `Drain` | Return and clear the caller's pending toasts for the selected project. → `200 {notifications:[…]}` |

The project and user both come from the resolved `access.Context` — never from a
query parameter — so a caller can only ever drain their own queue in their own
selected project.

## Status

**Wired and reachable over HTTP today**: the agent workflows push on task
settlement and the drain route is registered. State is in-memory only, by design.

## Related

- [Agents](agents/README.md) — the sole producer, via its `Notifier` port.
- [Presence](presence.md) — the other in-memory-by-design capability.
- [Runtime model §6](../runtime-model.md#6-phase-4--the-capability-meta-model) — the meta-model this capability deliberately departs from.
