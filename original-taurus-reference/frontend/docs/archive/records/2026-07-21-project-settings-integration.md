# Change record — 2026-07-21 — Real project settings (members, rename, icon, visibility) + display name

Omega already serves project membership and profile updates, but Alpha still mocked
them. This retires those mocks — the Project Settings dialog and the User Settings
display name now talk to real endpoints. Verified end to end in a browser (a
Playwright screenshot shows the real member with no mock badges).

## Real project fields + profile updates

```ts
// src/lib/data/projects.ts — GET /projects now carries icon/visibility; write via PATCH
function toProject(p) { /* …icon: toIcon(p.icon), visibility: toVisibility(p.visibility) */ }
export async function updateProject(id, { name?, icon?, visibility? }) {
  const p = await api(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  /* merge p.name/icon/visibility into the store */
}
```

**Why:** rename/icon/visibility were client-only mocks (icon in localStorage,
visibility non-persisted). **Purpose:** read the now-real `icon`/`visibility` from
`GET /projects` and persist changes via `PATCH /projects/:id`. **Why this way:** one
`updateProject` covers all three owner-gated fields and updates the store from the
returned project; the localStorage icon path and the `*Mock` helpers are deleted.
Omega's opaque `icon` string holds the UI's color key (`toIcon` falls back to `focus`).

## Real member management

```ts
// src/lib/data/projects.ts — /projects/:id/members
export async function fetchMembers(projectId) { /* GET → toMember[] */ }
export async function addMember(projectId, email, role) { /* POST {email, toOmegaRole(role)} */ }
export async function setMemberRole(projectId, userId, role) { /* PATCH {role} */ }
export async function removeMember(projectId, userId) { /* DELETE */ }
```

**Why:** the member list held only the signed-in user; add/role/remove were local.
**Purpose:** real membership CRUD, with a new `toOmegaRole` mirroring `toUiRole` so the
UI's owner/editor/viewer maps to Omega's owner/edit/read on the way out. **Why this
way:** members are fetched **on demand** in the settings dialog (component-local
state), not eagerly per project — so the projects-list avatar cluster stays self-only
until a future "member summary in `GET /projects`" backend request makes it real.

## The settings dialog goes real

```svelte
<!-- ProjectSettingsDialog.svelte -->
$effect(() => { if (open && id) { /* load real members into local $state */ } });
// owner-editable name (Save → updateProject), real icon/visibility, invite/role/remove
// with ApiError toasts; every "Mock" badge removed.
```

**Why:** the dialog rendered mock data behind "Mock" badges. **Purpose:** load the real
member list on open and wire every control to the real functions, surfacing Omega's
typed errors (e.g. "no account with that email", "already a member") as toasts.
**Why this way:** owner-only controls are gated on `project.role === 'owner'`; mutations
await the server and then update local state.

## Display name persists to Omega

```ts
// src/lib/data/session.ts — /auth/me now returns { id, email, name }
export function displayName(name, email) { return name?.trim() || nameFromEmail(email); }
export async function updateDisplayName(name) { /* PATCH /auth/me {name}, refresh session */ }
// UserSettingsDialog.svelte — saveProfile → updateDisplayName (was a local-only mock)
```

**Why:** the display name was derived from the email and edits were local-only.
**Purpose:** read the real `name` from `/auth/me` (falling back to email-derived when
empty) and persist edits via `PATCH /auth/me`. **Why this way:** a shared `displayName`
helper gives a consistent fallback for the current user and for members whose name is
blank.

## Browser verification

```ts
// e2e/project-settings.spec.ts — create a project via API, open its settings, assert real member
await expect(page.getByText(/Members ·/)).toBeVisible();
await expect(page.getByText('You')).toBeVisible();
await expect(page.getByText('dev@taurus.local')).toBeVisible();
```

**Why:** "it compiles" is not "it works". **Purpose:** a Playwright test drives login →
project settings and confirms the real member (You / Owner / dev@taurus.local) renders
with no mock badges, then screenshots it. **Why this way:** the suite runs serially
(shared backend), and creates/deletes its fixture project via API so the dev account
stays clean.

Verified: `pnpm check` (0/0) + `pnpm build`; `e2e/project-settings.spec.ts` green with
the confirming screenshot. Deferred (tracked): the display-name browser test; the
projects-list member summary (a backend request); link self-join.
