# Backend request — project updates (rename, visibility, timestamps)

Additions to the project resource. **Rename, icon, visibility, role-carrying share
links, and timestamps have shipped**. Alpha still needs to map and render timestamps;
that is front-end follow-up rather than an open Omega request (see
[discrepancies/projects.md](../discrepancies/projects.md)).

## 1. Rename — Medium · ✅ Shipped

**Delivered:** owners edit the project name in Project Settings; Alpha calls
`PATCH /projects/:id` through `updateProject` and folds the returned name into its
Project store.

```http
PATCH /projects/:id { "name" }   # owner only
  -> 200 { "id", "name", "role", ... }   # 400 on empty name
```

## 2. Visibility / link access — Medium · ✅ Shipped

**Delivered** as role-carrying share links (taurus-omega record `0033`). `visibility`
persists via `PATCH /projects/:id` and is the **master switch**; sharing itself is done
with per-role link tokens:

```http
PUT    /projects/:id/links/:role   # owner; role = read|edit → { role, token }
GET    /projects/:id/links         # owner; list active links
DELETE /projects/:id/links/:role   # owner; turn a link off
POST   /join/:token                # signed-in; join or upgrade at the link's role
```

Joins are upgrade-only (never demote; owners untouched), and a token `404`s when its
project isn't `link`-visible. This went further than the original ask — separate **read**
and **edit** links, rather than a single read-only self-join.

## 3. Timestamps — Low · ✅ Shipped (Alpha UI pending)

**Delivered:** `GET /projects` returns `createdAt` and `updatedAt`. The projects list
still has no time column because Alpha's `Project` type does not map those fields yet.

```http
GET /projects -> { "projects": [ { "id", "name", "role", "updatedAt" } ] }
```

## 4. Icon — Low · ✅ Shipped

**Delivered:** a per-project `icon` is shared Omega truth. Alpha stores its semantic
color key in the opaque string and falls back to `focus` for unknown/empty values.

```http
PATCH /projects/:id { "icon": "action" | "intel" | "focus" | ... }
GET /projects -> { "projects": [ { "id", "name", "role", "icon" } ] }
```

## Front-end follow-up

- Rename — **done**: an owner-editable name field wired to `updateProject` (PATCH).
- Icon — **done**: the picker calls `updateProject`; the color persists in Omega's
  opaque `icon` field (the localStorage path was removed).
- Visibility & share links — **done**: the toggle persists via `updateProject`, and the
  settings dialog manages read/edit links (`fetchLinks` / `rotateLink` / `disableLink`);
  the `/join/:token` route signs the recipient in (if needed) and joins them at the
  link's role.
- Timestamps — **backend done, Alpha pending**: map `createdAt` / `updatedAt` onto the
  `Project` type and add the projects-list "Edited" column with relative time.
