# Session presence enrichment (1c)

Adds `userEmail` to the session data returned by `GET /sessions` and stored
in the `project_sessions` table. Previously the session response carried only
`userId` and `userName` — the email gives the Alpha document bar an additional
lookup key for identity resolution.

## What changed

- **`Session` struct** — added `UserEmail string` with JSON tag
  `json:"userEmail,omitempty"`.

- **`Sessions.Start()`** — new `userEmail` parameter. Set on the created
  session alongside `userName`.

- **Session handler** — `Start` passes `ctx.User.Email` through to the
  capability's `Start` method. The email is already available on the access
  context.

- **SQLite `project_sessions`** — added `user_email TEXT NOT NULL DEFAULT ''`
  column to the CREATE TABLE. Migration ALTER for existing tables. Updated
  `UpsertProjectSession` INSERT + ON CONFLICT UPDATE to include `user_email`.
  Updated `ListProjectSessions` SELECT and scan to include the column.

- **MemoryStore** — no changes needed. It stores the full `Session` struct
  in a map, and `UserEmail` is now set by `Start()` before the upsert call.

- **Tests** — `TestMultipleUsersSameProject` verifies `UserEmail` for both
  users. `TestSessionEndpoints` transport test asserts the start response
  includes `userEmail` matching the authenticated user's email.

## Why

Alpha's document bar presence tracking in `systems/documents/collaboration.ts`
polls `GET /sessions` and maps sessions to collaborator shapes. Adding
`userEmail` lets the client resolve users against identity profiles without
an additional API round-trip. No new mock badge is removed — this is a data
enrichment on an already-wired endpoint.
