# sqlite_agent.go

The durable agent-task slice of the SQLite `Store`. One table, `agent_tasks`,
backs it, and it is deliberately document-shaped: the whole `agent.Task` is
stored as JSON in the `content` column, while `id`, `project_id`,
`requester_id`, `persona_id`, `state`, `target_document_id`, and the timestamps
are duplicated into real columns purely so they can be queried and indexed.
Every read selects `content` alone and decodes it — the scalar columns are never
the source of truth for a task's fields.

The table also carries the worker-lifecycle state that lets tasks survive a
crash: a `state` machine (queued → running → …) and a `heartbeat_at` stamp that a
reaper uses to recover tasks whose worker died. This file is part of the one
shared `*Store` and connection; the split from `sqlite.go` mirrors
`core/capability/agent`.

## Code breakdown

### File header and imports

Alongside the usual storage imports, this file pulls in `strconv` and `strings`
— used only by the legacy-decoding fallback at the bottom — and both the `agent`
and `persona` capability packages, the latter because a task embeds a persona
snapshot.

### CreateTask — write the task as a JSON document

Marshals the whole task and inserts it, projecting the queryable fields into
their own columns in the same statement. Nothing validates that the projection
agrees with the JSON; the writer is trusted to pass a coherent task, and readers
only ever trust `content`.

### TasksByDocument, TasksByProject, TasksByPersona — the three listings

Three near-identical queries over `content`, differing only in their `WHERE`
clause, each `ORDER BY created_at` so callers see tasks in the order they were
requested. The repetition is intentional: each is a straight-line
query/scan/decode loop, and the projected columns exist precisely so these
filters are cheap. Each returns `rows.Err()` as the final error so an iteration
that stopped early is not silently reported as a short list.

### TaskByID and scanTask

`TaskByID` selects one `content` and hands the `*sql.Row` to `scanTask`, which
maps `sql.ErrNoRows` to `agent.ErrTaskNotFound` and otherwise defers to
`decodeTask`. Note the signature takes a concrete `*sql.Row`, not the package's
`rowScanner` — the multi-row paths scan the raw string themselves rather than
reusing this helper.

### UpdateTask — full-document rewrite

Re-marshals the task and rewrites `state`, `content`, and `updated_at` for that
id. `RowsAffected() == 0` means the task is gone, reported as
`agent.ErrTaskNotFound` so an update to a deleted task is not silently lost.

### BeginTaskRun — claiming a task without a lock

The concurrency-critical write. Transitioning queued → running is expressed as a
single conditional `UPDATE` whose `WHERE` clause includes the state the task must
still be in:

```go
`UPDATE agent_tasks SET state = ?, content = ?, updated_at = ?, heartbeat_at = ?
 WHERE id = ? AND state = ?`   // ... running, ..., taskID, queued
```

Because SQLite applies that atomically, two workers racing for the same task
cannot both succeed — the loser sees zero rows changed. Content, state, and the
first heartbeat are all set in that one statement, so a task is never observed
running with a stale heartbeat that the reaper would immediately claim back.

On zero rows the method distinguishes the two failures by re-reading the task: a
missing task yields `agent.ErrTaskNotFound`, an existing one that simply was not
queued yields `agent.ErrTaskNotRunnable`. The successful path re-reads too, so
the caller receives the task exactly as persisted rather than a locally
assembled copy.

### BumpHeartbeat — proof of life

Stamps `heartbeat_at` for a task, guarded by `state = running` so a heartbeat
from a worker that has already been reaped (or finished) cannot resurrect or
disturb the row. Timestamps here use `sortableTime` rather than the ordinary
`timeLayout`, because the reaper compares heartbeats with `<` in SQL and needs a
fixed-width fractional second for lexical order to match chronological order.

### ReapStaleTasks — recovering after a crashed worker

Flips every running task whose heartbeat predates `before` back to `queued` and
clears the heartbeat, so it can be claimed afresh by `BeginTaskRun`. The
`heartbeat_at != ''` guard skips rows that never got a heartbeat, and clearing
the stamp on reap makes the state self-consistent: a queued task carries no
heartbeat. This is what makes the queue durable — a worker that dies mid-task
leaks nothing more than one reap interval.

### decodeTask — tolerating an older on-disk encoding

Reads a `content` string into an `agent.Task`. The fast path is a plain
`json.Unmarshal` of the whole task, which is what every current writer produces.
If that fails, the row is assumed to be an older encoding rather than corrupt,
and is repaired field-by-field through a generic map form:

```go
var aggregate map[string]json.RawMessage
```

Decoding into `json.RawMessage` leaves every field untouched except the one that
needs fixing. The historical mismatch is in the embedded persona snapshot: its
`version` used to be a string like `"v3"` where the current type wants an int,
and `name` did not exist at all. So the fallback pulls the snapshot out, parses
the numeric part after trimming the `v` prefix (rejecting anything that is not a
version ≥ 1 as invalid rather than guessing), back-fills `name` from the persona
id — special-casing `persona.GeneralID` to the friendlier "General" — re-marshals
the aggregate, and decodes that normalized JSON into the task.

The fallback exists because tasks are stored as whole JSON documents: there is no
column to migrate when a struct changes shape, so old rows are upgraded lazily on
read. It is read-only — the repaired form is not written back — which keeps the
migration free of write amplification at the cost of repeating the fix-up on
every read of a legacy row.
