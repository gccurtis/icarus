# Backend request — project members

**Priority:** High · **Status:** ✅ Shipped (2026-07-21)
**Unblocked:** real members / add / role / remove controls in Project Settings.
**Still separate:** the projects-list avatar cluster needs a compact member summary in
`GET /projects`; it currently shows only the signed-in user. See
[discrepancies/projects.md](../discrepancies/projects.md).

## What shipped

For a project, the ability to **read the full member list** (not just the caller's
own role) and to **manage membership**: invite a user by email at a role, change a
member's role, and remove a member. Roles are owner / edit / read (the UI shows
owner / editor / viewer and translates).

The dedicated member endpoints below are live. `GET /projects` still returns the
caller's role but no member summary, so the settings dialog fetches the full list on
demand while the projects-list card shows only the caller.

## Shipped API

```http
GET    /projects/:id/members
  -> 200 { "members": [ { "userId", "name", "email", "role" } ] }

POST   /projects/:id/members        { "email", "role" }   # invite / add
  -> 201 { "userId", "name", "email", "role" }            # 404 if no such user, 409 if already a member

PATCH  /projects/:id/members/:userId { "role" }           # change role (owner only)
  -> 200

DELETE /projects/:id/members/:userId                       # remove (owner only)
  -> 200
```

Delivered semantics:

- Member records include real names and emails; Alpha falls back to an email-derived
  display name only when `name` is empty.
- Adding by email requires an existing account; there is no pending-invite model.
- The dedicated endpoint keeps settings accurate. A compact summary on
  `GET /projects` remains a
  [separate low-priority request](project-member-summary.md) to avoid an N-request
  fan-out on the list.

## Front-end follow-up — done (2026-07-21)

Shipped as proposed. In `src/lib/data/projects.ts` the `*Mock` helpers were replaced
with `fetchMembers` / `addMember` / `setMemberRole` / `removeMember`; the settings
dialog fetches the real member list on open and its "Mock" badges are gone. Omega adds
an **existing** user by email (no pending invites) and returns a real `name` (the
display-name item, also shipped). The projects **list** avatar cluster still shows
only you — a "member summary in `GET /projects`" is filed separately so the list can go
real without an N-request fan-out. See
[compact project member summaries](project-member-summary.md).
