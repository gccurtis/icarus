# Manual test: share links

This is the by-hand version of [`run.sh`](run.sh). It walks **role-carrying share
links**: an owner mints a `read` and/or `edit` link; anyone who opens one joins the
project at (or is upgraded to) that role. Joins are **upgrade-only** (a link never
demotes an existing member, and an owner is never lowered), and the project's
`visibility` is the **master switch** — `private` disables the links.

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, and you send the
session cookie saved at login with `-b`. Two identities are used below: the **owner**
(`cookies.txt`) and a **joiner** (`other.txt`).

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- Start the core (`go run ./core`). Register + login the owner (cookie → `cookies.txt`)
  and create a project (see the [projects manual](../projects/manual.md)); note its
  `<PROJECT_ID>`. Register + login a second account (cookie → `other.txt`).

## 1. Mint the links (owner)

```bash
# Read link.
curl -ik -b cookies.txt -X PUT https://127.0.0.1:8080/projects/<PROJECT_ID>/links/read
# 200 {"role":"read","token":"<READ_TOKEN>"}

# Edit link.
curl -ik -b cookies.txt -X PUT https://127.0.0.1:8080/projects/<PROJECT_ID>/links/edit
# 200 {"role":"edit","token":"<EDIT_TOKEN>"}
```

Links grant `read` or `edit` only — an owner link is refused (**400**). `PUT` again for
a role **rotates** it: a fresh token, and the old one stops working.

## 2. List them (owner only)

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/projects/<PROJECT_ID>/links
# 200 {"links":[{"role":"read","token":"…"},{"role":"edit","token":"…"}]}
```

A non-owner (member or not) gets **403** here and on mint/delete.

## 3. Turn sharing on (owner)

Links only work while the project is shared. A fresh project is `private`, so first:

```bash
curl -ik -b cookies.txt -X PATCH https://127.0.0.1:8080/projects/<PROJECT_ID> \
  -H 'Content-Type: application/json' -d '{"visibility":"link"}'
```

While `private`, `POST /join/<TOKEN>` returns **404** — a link reveals nothing when the
master switch is off.

## 4. Join by token (the recipient)

```bash
# Read link → read member.
curl -ik -b other.txt -X POST https://127.0.0.1:8080/join/<READ_TOKEN>
# 200 the project at role "read"; it now appears in GET /projects for this user.

# Edit link → upgraded to edit.
curl -ik -b other.txt -X POST https://127.0.0.1:8080/join/<EDIT_TOKEN>
# 200 the project at role "edit".

# Read link again → still edit (upgrade-only, never downgrades).
curl -ik -b other.txt -X POST https://127.0.0.1:8080/join/<READ_TOKEN>
# 200 role "edit".
```

An unknown token — or any token once the project is `private` again — returns **404**.
`POST /join/:token` needs a signed-in user but **no selected project**.

## 5. Turn a link off (owner)

```bash
curl -ik -b cookies.txt -X DELETE https://127.0.0.1:8080/projects/<PROJECT_ID>/links/edit
# 200 {"status":"deleted"}
```

The deleted token stops working (**404**). Members who already joined keep their role —
turning a link off (or flipping the project `private`) never removes anyone.
