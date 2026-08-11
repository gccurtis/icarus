# Project member summary on GET /projects (backend-outstanding Phase G)

`GET /projects` now carries a bounded member summary per project, so the project
list renders avatar clusters without one member request per row.

## Change

The projects-list projection gains an additive **`members`** field:
`{ items: [{ userId, name, avatarUrl }], total }`. `items` is capped at a small
avatar-cluster stack (**`DefaultMemberStackSize` = 5**), ordered by email; `total`
is the exact member count. The items carry only **public-safe** identity — no
email and no role, the same safety as any public profile projection — distinct
from the full `GET /projects/:id/members` endpoint.

## Store

New batched read `MembersSummaryByProjects(projectIDs, limit)` on the membership
store returns, in **one query**, a `map[projectID]ProjectMemberSummary` — up to
`limit` ordered items plus the exact total per project, an entry for every
requested project (even with zero extra members). The access service exposes it
as `Access.MembersSummaryByProjects`; the handler calls it with the caller's own
project ids (already authorized by `ProjectsForUser`), so no per-project
membership re-check is needed. `MemberSummary{ UserID, Name, AvatarURL }` and
`ProjectMemberSummary{ Items, Total }` are the new access types.

## Tests

- Unit (`core/capability/access`): a project with eight members returns `total`
  8 with `items` capped at five; a second project returns the owner alone; the
  owner's avatar surfaces in the summary; empty input returns no entries.
- Dev-test (`dev-test/projects`, free): after adding a member, `GET /projects`
  reports `members.total` 2 with two items, each carrying `userId` / `name` /
  `avatarUrl` and **no** `email` or `role`.

## Settled

- Additive `members` summary on the list projection; items ≤ 5, exact total. ✓
- Public-safe fields only (no email, no role), reusing the public-profile safety. ✓
- One batched `MembersSummaryByProjects` read, not N per-project queries. ✓
- Default stack size 5 (a standard avatar-cluster size), trivially adjustable.
