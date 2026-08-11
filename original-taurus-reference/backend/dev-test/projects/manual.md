# Manual test: projects

This is the by-hand version of [`run.sh`](run.sh). It walks project management
and selection: **list / create / update (owner only) / select / delete (owner
only) / leave (self)**, and the access levels behind them.

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, and you send
the session cookie saved at login with `-b cookies.txt`.

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- Start the core (`go run ./core`) and sign in — register + login as in the
  [gateway manual](../gateway/manual.md), saving the cookie to `cookies.txt`.
  Every request below adds `-k -b cookies.txt`.

## 1. List your projects (empty at first)

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/projects
```

Expected: **200 OK** — `{"projects":[]}`.

## 2. Create a project — you become its owner

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/projects \
  -H 'Content-Type: application/json' -d '{"name":"First Project"}'
```

Expected: **201 Created** —
`{"id":"<PROJECT_ID>","name":"First Project","role":"owner","icon":"","createdAt":"…","updatedAt":"…"}`.
Note the `id`. Every project response carries an `icon` (empty until set) and
RFC3339 `createdAt`/`updatedAt`. An empty name returns **400**.

Listing again now shows it with `"role":"owner"`.

## 3. Update — profile fields and purpose

`PATCH` applies a **partial** change — send only the fields you want to change.
`name` renames; `icon` is an opaque client key (a color/glyph the cockpit
interprets; the backend just stores it, ≤ 64 chars); `visibility` is
`"private"`｜`"link"` (see §7). A new project is `private`. Owner only.

```bash
curl -ik -b cookies.txt -X PATCH https://127.0.0.1:8080/projects/<PROJECT_ID> \
  -H 'Content-Type: application/json' -d '{"name":"Renamed Project","icon":"intel"}'
```

Expected: **200 OK** — the project with the new `name`, `icon`, `visibility`, and a
bumped `updatedAt`. An empty name returns **400**; an over-long icon returns
**400**; a `visibility` outside the two values returns **400**; a non-owner (or
non-member) gets **403**.

Purpose is a trimmed plain-text field (≤1,000 Unicode characters). Owners and
editors may update it; the other profile fields remain owner-only. Empty purpose
clears it, an empty patch is 400, and an editor request mixing purpose with an
owner-only field fails as a whole.

```bash
curl -ik -b cookies.txt -X PATCH https://127.0.0.1:8080/projects/<PROJECT_ID> \
  -H 'Content-Type: application/json' -d '{"purpose":"Make knowledge useful."}'
```

## 4. Select a project (creates the cell)

Nothing is selected until you say so:

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/session/project        # {"selected":false}
```

Selecting a project you don't belong to is refused:

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/session/project \
  -H 'Content-Type: application/json' -d '{"projectId":"does-not-exist"}'   # 403
```

Select the real one — this is what creates the project **cell** (the runtime
object the rest of the app will use to reach everything the project needs):

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/session/project \
  -H 'Content-Type: application/json' -d '{"projectId":"<PROJECT_ID>"}'
curl -ik -b cookies.txt https://127.0.0.1:8080/session/project        # {"selected":true, "project":{…}}
```

## 5. Delete — owner only

```bash
curl -ik -b cookies.txt -X DELETE https://127.0.0.1:8080/projects/<PROJECT_ID>
```

Expected: **200 OK** — `{"status":"deleted"}`. Only an **owner** may delete; a
non-owner (or non-member) gets **403**.

## 6. Members — list / add / role / remove (owner-managed)

Reading the member list is open to **any member**; adding, changing a role, and
removing require **owner**. Adding is **add-existing-user**: the email must already
belong to an account (register the person first).

```bash
# Add an existing user by email at a role (owner only).
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/projects/<PROJECT_ID>/members \
  -H 'Content-Type: application/json' -d '{"email":"member@taurus.local","role":"read"}'
# 201 {"userId":"<USER_ID>","name":"Member","email":"member@taurus.local","role":"read"}
# 404 no account with that email · 409 already a member · 400 bad role · 403 not owner

# List members (any member).
curl -ik -b cookies.txt https://127.0.0.1:8080/projects/<PROJECT_ID>/members
# 200 {"members":[{"userId":"…","name":"…","email":"…","role":"…"}, …]}

# Change a member's role (owner).
curl -ik -b cookies.txt -X PATCH https://127.0.0.1:8080/projects/<PROJECT_ID>/members/<USER_ID> \
  -H 'Content-Type: application/json' -d '{"role":"edit"}'

# Remove a member (owner).
curl -ik -b cookies.txt -X DELETE https://127.0.0.1:8080/projects/<PROJECT_ID>/members/<USER_ID>
```

A change that would leave the project with **no owner** — demoting or removing the
last owner — is refused with **409**.

## 7. Visibility — the share master switch

A project is `private` (members only) or `link` (sharing on). Set it with the
owner-only PATCH from §3. Visibility is the **master switch** for share links: when
`private`, the project's share links stop working; when `link`, they work.

```bash
# Owner: turn sharing on.
curl -ik -b cookies.txt -X PATCH https://127.0.0.1:8080/projects/<PROJECT_ID> \
  -H 'Content-Type: application/json' -d '{"visibility":"link"}'
```

Flipping back to `private` disables the links without deleting them (or removing the
members who already joined). The role-carrying share links themselves — mint a
read/edit link, then join or upgrade by token — are covered in the
[links manual](../links/manual.md).

## 8. Leave (remove) — self, without deleting

`leave` removes *you* from a project but leaves it intact for other members:

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/projects/<PROJECT_ID>/leave
```

Expected: **200 OK** — `{"status":"left"}`. One guard: the **sole owner** may not
leave (it would strand the project) — that returns **409**; hand off ownership to
another member first, or delete the project. Afterward, since you're no longer a
member, deleting returns **403**.

## Access levels

A membership carries a role: **owner**, **edit**, or **read**. The creator is an
owner; only owners can delete, update (rename/icon/visibility), or manage members. Owners can
now grant **edit**/**read** to existing users and promote others to **owner** — the
one rule is that a project always keeps at least one owner.
