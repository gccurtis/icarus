# src/lib/data/projects.ts — breakdown

Companion to [projects.ts](projects.ts). A thin barrel that re-exports the
projects system module. The actual implementation lives in
`src/lib/systems/projects/api.ts`.

## Barrel re-export

### Forward everything from the projects system

```ts
export * from '$systems/projects/index';
```

This single-line barrel routes all project types, the `projects` store, and
every API function through the `$data` alias.

## Underlying implementation: `src/lib/systems/projects/`

### `types.ts` — shared project types

- **`Role`**: `'owner' | 'editor' | 'viewer'` (UI vocabulary; Omega uses
  `owner/edit/read`).
- **`Visibility`**: `'private' | 'link'`.
- **`Member`**: `{ id, name, email, role: Role }`.
- **`ShareLink`**: `{ role: 'read' | 'edit', token, url }`.
- **`IconColor`**: 7 semantic color keys (`action`, `intel`, `focus`,
  `attention`, `success`, `danger`, `neutral`) plus the `ICON_COLORS` array
  and `iconDotClass`/`iconTileClass` helpers (literal maps so Tailwind emits
  the classes).
- **`Project`**: `{ id, name, role, members: Member[], visibility, icon:
  IconColor, purpose }`.

### `store.ts` — the `projects` writable store

Holds `Project[]`, updated by every API call in the module.

### `api.ts` — Omega API layer

All operations are real, backed by Omega endpoints.

#### Role translation

`toUiRole` maps Omega's `owner/edit/read` to UI's `owner/editor/viewer`.
`toOmegaRole` does the inverse for writes. `currentUserId` reads the signed-in
user's ID from the session store. `selfMember` builds the one member the
projects screen renders — the current user at their project role.

#### API shape mapping

`ApiProject` and `ApiMember` are the raw Omega shapes. `toIcon` accepts an
opaque `icon` string only when it matches a known color key (defaulting to
`focus`). `toVisibility` narrows to `link` or `private`. `toProject` assembles
a front-end `Project` — translating the role, seeding `members` with the
current user, mapping icon/visibility/purpose. `toMember` maps an `ApiMember`,
deriving a display name via `displayName(name, email)` because Omega's stored
member name may be empty.

#### Projects: list / create / delete / leave / open

- `fetchProjects` — GET `/projects`, replaces the store.
- `createProject` — POST `/projects`, prepends to the store, returns the new ID.
- `deleteProject` — DELETE `/projects/:id`, removes from the store.
- `leaveProject` — POST `/projects/:id/leave`, removes from the store.
- `openProject` — POST `/session/project`, creates the session cell for the
  workspace.

#### Share links

- `fetchLinks` — GET `/projects/:id/links`, returns `ShareLink[]`.
- `rotateLink` — PUT `/projects/:id/links/:role`, returns the fresh link.
- `disableLink` — DELETE `/projects/:id/links/:role`.
- `joinByToken` — POST `/join/:token`, refreshes the project store, returns
  the new project ID.
- `linkUrl` builds the `/join/:token` URL from `location.origin`.

#### Project profile

`updateProject` sends a PATCH `/projects/:id` with any subset of `name` /
`icon` / `visibility` / `purpose`. The server's echoed row is merged back into
the store, re-normalizing icon and visibility. Field-level authorization is
Omega's responsibility: owners may change every field; editors may change
purpose.

#### Members

- `fetchMembers` — GET `/projects/:id/members`, returns `Member[]` without
  touching the `projects` store.
- `addMember` — POST `/projects/:id/members` with email + role (translated to
  Omega), returns the mapped `Member`.
- `setMemberRole` — PATCH `/projects/:id/members/:userId` with translated role.
- `removeMember` — DELETE `/projects/:id/members/:userId`.

All write operations are owner-gated by Omega.

#### Project names / formulas (added in this change)

- **`NamesEntry` type**: `{ name, type: 'null' | 'number' | 'text' | 'logic' |
  'table' | 'function', value: unknown, source?: string, createdAt, updatedAt }`.
- **`fetchProjectNames(projectId)`**: GET `/projects/:id/names`, returns
  `NamesEntry[]`.
- **`setNameValue(projectId, name, value)`**: PUT
  `/projects/:id/names/:name/value` with a raw JSON value body.
- **`setNameFunction(projectId, name, source)`**: PUT
  `/projects/:id/names/:name/function` with `{ source }`, assigning a formula
  to a name.
- **`evaluateExpression(projectId, source)`**: POST
  `/projects/:id/evaluate` with `{ source }`, returns `{ value, type }` for
  live formula preview.
- **`deleteProjectName(projectId, name)`**: DELETE
  `/projects/:id/names/:name`.
