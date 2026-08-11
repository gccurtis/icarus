# Front-end requests

Changes Omega needs the cockpit (`taurus-alpha`) to make.

This is the mirror of the "backend requests" the cockpit files against Omega. When
a change here alters the request contract — a new required header, a changed
route, a new error a client must handle — it gets a document in this directory
saying exactly what the client must do, so the work can be picked up without
reading Go.

Each document states: what changed, why, **what the client must send**, what
happens if it doesn't, and how to verify.

| Request | Status | Summary |
|---|---|---|
| [CSRF token header](csrf-token-header.md) | **Required** | Authenticated mutations must echo the `to_csrf` cookie in an `X-CSRF-Token` header. |
| [Job routes moved to `/dev`](job-routes-moved-to-dev.md) | Required if used | `GET /jobs/:jobID` is now `GET /dev/jobs/:jobID`. |

## Conventions

- **Required** means the server enforces it now; a client that has not adopted it
  will fail.
- **Advisory** means the server accepts both shapes and the old one is deprecated.
- When a request is adopted and released, move its row to the bottom under a
  "Landed" heading rather than deleting the document — the reasoning stays useful.
