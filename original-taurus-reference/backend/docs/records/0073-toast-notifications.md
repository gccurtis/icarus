# Toast notifications (Alpha gap G3)

The Alpha gaps note asks only for the ability to "push a notification to the
screen at any given point in time" — a toast — not a durable per-user inbox. So
this is a deliberately thin, ephemeral signal channel: the server emits a toast
when something worth surfacing happens, the client drains its pending toasts, and
nothing is persisted. A toast lost to a process restart is acceptable by design;
no downstream logic treats a toast as a source of truth.

## Capability: `core/capability/notification`

- **`Toast{ id, level, title, body, projectId, createdAt }`** — one ephemeral
  message addressed to a single user in one Project. `Level` is a closed
  vocabulary (`info` / `success` / `warning` / `error`) the client uses to style
  the toast. `id` and `createdAt` are assigned by `Push`; callers supply only
  level/title/body/projectId.
- **`Notifications`** — a bounded, in-memory fan-in of per-user, per-Project
  queues, safe for concurrent producers (task workers) and consumers (HTTP
  drains). Keyed by `(projectID, userID)` so a user in several Projects keeps a
  separate queue per Project.
  - `Push(userID, Toast)` — appends one toast, assigning `id`/`createdAt`,
    clamping oversized text on a rune boundary, and defaulting an unknown level
    to `info`. An empty `userID` is ignored so a task with no known requester
    cannot accumulate undeliverable toasts. Past the per-user bound (100) the
    oldest toast is dropped.
  - `Drain(projectID, userID) []Toast` — returns and removes every toast queued
    for a user in one Project, oldest first, delivered exactly once. An empty
    queue returns a non-nil empty slice.

Nothing persists: `notification.New()` is the whole lifecycle, held only in the
composition root. This is why the queue is **Project-scoped on drain** rather than
global — everything else in the system is Project-scoped, and a toast about a task
in Project A should surface when the user is viewing Project A, not Project B.

## Producer: the durable task runner

The Agent workflow is the first (and currently only) producer. A new narrow port
keeps the direction one-way and testable:

```go
// core/capability/agent/workflow.go
type Notifier interface {
    Push(userID string, toast notification.Toast)
}
```

`*notification.Notifications` satisfies it without an adapter — the same pattern
the Agent capability already uses for its `Intelligence` / `Knowledge` /
`PersonaResolver` ports. A nil `Notifier` disables toasts entirely.

The three places a run settles into a terminal state (the `RunJob` failure path,
`finishPlan`, `finishAction`) now funnel through one `settle(...)` helper that
records the run with `FinishRun` and then calls `notifySettled`. Notification is
**best-effort and after the fact**: the durable task state is the outcome, and a
lost toast never fails a run. `settledToast` maps the settled state to a toast —
`completed → success`, `partially_completed → warning`, `failed → error` (body =
failure) — and returns "no toast" for a non-terminal `waiting`, since pausing for
input is not an outcome worth toasting. The toast is addressed to the task's
`RequesterID` and carries the task's `ProjectID`.

## Endpoint

`GET /notifications` drains the caller's pending toasts for the selected Project
(`core/handlers/notification`). Registered only when `Options.Notifications` is
set. It is destructive by contract — a toast is delivered exactly once — so there
is no separate "mark read" call.

## Wiring

`notification.New()` is constructed once in `core/wiring`, injected into the Agent
workflow as its `Notifier`, and passed to the transport as `Options.Notifications`
so the same in-memory queue backs both the producer and the drain endpoint.

## Tests

- Unit (`core/capability/notification`): push→drain-once, per-user isolation,
  Project-scoped isolation, empty-user ignored, bounded (oldest dropped), unknown
  level defaults to info.
- Unit (`core/capability/agent`): a completed task pushes a success toast to the
  requester; a failed task pushes an error toast; a nil `Notifier` is safe.
- Dev-test (`dev-test/notifications`, live, skip-on-no-key): empty drain before
  any task → run a real Plan task to a terminal state → the settled state's
  matching toast is delivered → the second drain is empty. The suite asserts the
  toast level against whatever terminal state occurred, so it verifies the
  notification contract rather than the model's success.

## Settled

- Ephemeral, in-memory, not persisted; a lost toast is acceptable. ✓
- Per-user, Project-scoped drain (queue keyed by project + user). ✓
- Closed level vocabulary; server assigns id/createdAt; bounded per-user queue. ✓
- One-way `Notifier` port; nil disables; best-effort, never fails a run. ✓
- Task runner pushes on terminal settle (completed/partial/failed). ✓
