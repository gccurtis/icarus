# sqlite_sessions.go

Persistence for **presence sessions**: one row per user per project recording
who is currently in a project, what they are looking at, and where their caret
sits. This backs `session.Store` for the session capability, whose service layer
owns the event queue and the stale-session sweeper; this file only reads and
writes `project_sessions`.

These are **not** the authentication sessions. Login sessions (`access.Session`,
the `sessions` table, `CreateSession`/`SessionByID`/`DeleteSession`) live in
`sqlite_access.go` and are keyed by an opaque session ID held in a cookie. A
presence session is keyed by `(project_id, user_id)`, carries no credential, and
is safe to delete at any time — losing one drops a collaborator's cursor from
the presence list, nothing more. The two share only a name.

## Code breakdown

### File header: one Store, one connection, split by capability

The package clause repeats the note carried by every file in this split: all of
these methods hang off the same `*Store` over a single connection, so the
file boundary is organizational and mirrors `core/capability`. Imports are just
`time` and the `session` capability whose types cross the boundary.

### `UpsertProjectSession` — join or re-join without clobbering the caret

An insert with `ON CONFLICT(project_id, user_id) DO UPDATE`. The insert supplies
every column, but the conflict branch deliberately updates only identity and
timing:

```go
ON CONFLICT(project_id, user_id) DO UPDATE SET
	session_id       = excluded.session_id,
	user_name        = excluded.user_name,
	user_email       = excluded.user_email,
	started_at       = excluded.started_at,
	last_activity_at = excluded.last_activity_at
```

The focus columns (`current_document_id`, caret, selection) are **not** in that
list, so re-announcing presence — a reconnect, a second tab, a fresh page load —
never resets where the user's cursor already is. Caret movement has its own
write path below.

### `CloseProjectSession` — leaving is a delete, not a flag

Presence is ephemeral, so departure removes the row outright. A missing row is
not an error: closing a session twice, or closing one the sweeper already
reaped, both succeed.

### `UpdateProjectSession` — caret and selection movement

A plain `UPDATE` of the focus columns plus `last_activity_at`, keyed on
`(project_id, user_id)`. Unlike the upsert it will not create a row, and it does
not check `RowsAffected` — a caret update for a user who is not present is
silently dropped rather than resurrecting a closed session.

### `ListProjectSessions` — who is here, most recently active first

Reads a project's rows ordered by `last_activity_at DESC`. Timestamps are parsed
back with `timeLayout`; a parse failure leaves the zero time rather than failing
the whole listing. The result is normalized to an empty slice when nothing
matched, so callers (and the JSON encoder above them) see `[]`, never `null`.

### `BumpProjectSessionActivity` — the cheapest liveness touch

A single-column `UPDATE` of `last_activity_at`. This is what the frequent,
high-volume path calls — it keeps a user ahead of the sweeper's cutoff without
rewriting caret state or re-running the upsert.

### `DeleteStaleProjectSessions` — the sweeper's half of the bargain

Deletes every row whose `last_activity_at` is older than the given instant,
across all projects, so a client that disappeared without calling
`CloseProjectSession` eventually stops showing as present. The comparison is a
lexical string comparison in SQL, which only matches chronological order because
these timestamps are written with `sortableTime` — the fixed-width layout from
`sqlite.go`, not the trailing-zero-trimming `timeLayout`. Every write in this
file uses `sortableTime` for exactly that reason.
