# Discrepancy — projects

What the project selection + settings screens get from Omega, and what remains.
Endpoints confirmed live and in `taurus-omega/dev-test/projects/manual.md`.

## What's real

`GET /projects` → `{ "projects": [{ "id", "name", "role", "icon", "purpose",
"visibility", "createdAt", "updatedAt" }] }`. Wired in
[`projects.ts`](../../src/lib/data/projects.ts):

- **List / create / delete / leave / open** — `GET/POST/DELETE /projects`,
  `POST /projects/:id/leave`, `POST /session/project`.
- **Profile updates** — `PATCH /projects/:id {name?, icon?, visibility?, purpose?}`
  via `updateProject`. Rename, icon, and visibility are owner-gated; owners and
  editors may update purpose.
- **Members** — `GET/POST/PATCH/DELETE /projects/:id/members` via
  `fetchMembers/addMember/setMemberRole/removeMember`. The settings dialog shows the
  real member list; invite/change-role/remove are real (owner only).
- **Share links** — `GET/PUT/DELETE /projects/:id/links[/:role]` + `POST /join/:token`
  via `fetchLinks/rotateLink/disableLink/joinByToken`. Owners mint / rotate / turn off a
  read and an edit link in settings; opening a link signs the recipient in (if needed)
  and joins them at the link's role (upgrade-only). Visibility is the master switch.

The UI's icon color is stored in Omega's opaque `icon` string (`toIcon` falls back to
`focus`). `purpose` is mapped into the Project store and surfaced on Overview.
`createdAt` / `updatedAt` come back from Omega but are not yet mapped into the
front-end `Project` type or shown on the projects list.

## Roles

Omega `owner / edit / read` ↔ UI `owner / editor / viewer`, translated **both ways**
(`toUiRole` / `toOmegaRole`) at the data boundary. See [roles.md](roles.md).

## The remaining gaps

| UI feature | Backend today | Handling |
| --- | --- | --- |
| **Members on the projects LIST** (avatar cluster) | `GET /projects` returns no member summary — only your role | The list card shows **only you**; the full member list is fetched on demand in settings. A future "member summary in `GET /projects`" request makes the list real. |
| **Last-edited column** | `updatedAt` is returned | Alpha does not map the field yet or render an "Edited" column. This is front-end follow-up, not missing backend capability. |

## Backend work still tracked

[`docs/backend-requests/`](../backend-requests/README.md) still tracks a **member
summary in `GET /projects`** to make the list avatars real without an N-request fan-out.
The timestamp fields and share-link APIs have already landed; surfacing "last edited"
is now Alpha-only work.

## Status

Members, rename, icon, visibility, and **role-carrying share links** are all **real** as
of 2026-07-21 (project-settings + share-links integration). Remaining: the list avatar
cluster is self-only by design (a backend member-summary would make it real), and the
"last edited" column is an unscheduled front-end follow-up over already-returned data.
