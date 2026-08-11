# 0033 — Role-carrying project share links

Projects can now be shared by unguessable, role-carrying links: an owner mints a
read link and/or an edit link; anyone who opens one joins the project at (or is
upgraded to) that role. This replaces the old id-based `POST /projects/:id/join`
(which granted read to any signed-in user who merely knew the project id) with token
capability URLs. Joins are **upgrade-only** — a link never demotes an existing member,
and an owner is never lowered. The project's `visibility` field is the master switch:
`private` disables all its links; `link` enables them.

## core/capability/access/project.go

### ProjectLink + ProjectLinkStore

Added a `ProjectLink{ProjectID, Role, Token}` domain type and a `ProjectLinkStore`
port (`PutProjectLink`, `ProjectLinkByToken`, `ProjectLinksForProject`,
`DeleteProjectLink`, `RemoveProjectLinks`). At most one link exists per
`(project, role)`; the token is the secret. Keeping links behind a port leaves the
capability free of any concrete DB, like every other store.

### Role ranking + link-role validation

`roleRank` (owner > edit > read) drives the upgrade-only comparison; `validLinkRole`
restricts links to read/edit, so an owner-granting link is rejected
(`ErrInvalidLinkRole`) — too dangerous to hand out by URL.

### The four service methods

Owner-gated `CreateOrRotateProjectLink` / `ProjectLinks` / `DeleteProjectLink` (via
`requireOwner`, mirroring member management), plus `JoinByLink(userID, token)`: look up
the token, enforce the `visibility == link` master switch, then grant the link's role
or upgrade the member to it — never below their current role. Unknown or disabled
tokens return `ErrNotFound`, the same secrecy the old join used, so a link reveals
nothing when it's off. `DeleteProject` now also calls `RemoveProjectLinks`, and the old
`JoinProject` (id-based read self-join) was removed.

## core/capability/access/access.go

Added `ErrInvalidLinkRole` and the `Links ProjectLinkStore` field on `Stores`.

## core/capability/access/memory.go

The in-memory store gained a `links` map (by token) and the five `ProjectLinkStore`
methods for unit tests; `PutProjectLink` enforces one-link-per-`(project, role)`.

## core/platform/storage/sqlite/sqlite.go

Added the `project_links` table (composite PK `(project_id, role)`, unique index on
`token`) and its five store methods. `PutProjectLink` upserts on the PK while writing a
fresh token; `ProjectLinkByToken` maps `sql.ErrNoRows` to `access.ErrNotFound`; the
whole thing cascades away with the project.

## core/handlers/project/project.go + core/transport/transport.go + core/wiring/wiring.go

New owner-gated routes `GET /projects/:projectID/links` and `PUT|DELETE
/projects/:projectID/links/:role`, plus a top-level gated `POST /join/:token` (a
signed-in user, no selected project needed). The handlers `Links` / `RotateLink` /
`DeleteLink` / `JoinByToken` map the access errors to 403/400/404 like the member
handlers, and return `{role, token}` for a link. `wiring.go` passes the single
`sqlite.Store` as the new `Links` port. The old `POST /projects/:projectID/join` route
and `Join` handler were removed.

## dev-test + tests

`dev-test/links/` (auto-discovered, offline — no model key) drives the whole flow end
to end over HTTPS: mint read+edit links, owner-link rejected, list owner-only,
private-blocks, join read → upgrade to edit → no downgrade, non-owner 403, rotate and
delete invalidate tokens, unknown token 404. `dev-test/projects/` dropped its self-join
step (now covered here). Unit coverage: `TestProjectLinks` (domain) and the rewritten
transport `TestProjectVisibility` exercise the same matrix.
