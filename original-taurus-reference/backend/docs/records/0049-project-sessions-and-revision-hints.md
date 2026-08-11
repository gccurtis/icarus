# Project Sessions and Revision Hints

Adds R13 from the document backend checklist: per-project session
tracking with caret/selection state, activity observation via a
middleware-driven event queue, and a lightweight revision hints endpoint
for staleness detection.

## What changed

- **New capability `core/capability/session/`** — `Session` domain type,
  `Store` interface, `Sessions` service with an internal buffered event
  queue, a consumer goroutine that writes `last_activity_at`, and a
  periodic sweeper that removes stale sessions.

- **New handler `core/handlers/session/`** — four REST endpoints on the
  project-scoped group:
  - `POST /sessions` — start (upsert) a session for the current user
  - `DELETE /sessions/current` — close the session
  - `PUT /sessions/current` — update current document, caret, and selection
  - `GET /sessions` — list all active (non-expired) sessions in the project

- **SQLite `project_sessions` table** — one row per `(project_id, user_id)`
  with session identity, current document/position, and activity timestamps.

- **Session activity middleware** — an Echo middleware wrapping project-
  scoped routes pushes an event to the session queue on every 2xx
  response to a POST/PUT/DELETE/PATCH request. The consumer bumps
  `last_activity_at`. GET requests do not count as activity.

- **Revision hints** — `GET /documents/revision-hints` on the document
  handler returns `{documentID: revision}` for every document in the
  project. Uses the existing `DocumentsByProject` store query (no new
  index needed).

- **Wiring** — `sessions := session.New(store, ...)` constructed in
  `Run()`, passed through `transport.Options`, deferred `Stop()` on
  shutdown.

## Why

The reference docs describe presence as an adjacent ephemeral subsystem.
Rather than making it document-specific or building a realtime protocol
now, the session is project-scoped, stored durably so it survives
application restarts, and tied to normal request activity instead of a
separate heartbeat stream. No document model, change set, or history
change was required — session sits entirely outside the document
aggregate.

R14 and R15 remain deferred.
