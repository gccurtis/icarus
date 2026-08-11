# Change record — 2026-07-20 — Sign-in and project selection screens

The first real application screens, built on the component library with a mock
data layer that stands in for Omega until the backend is connected. Project-first,
matching the application-shell reference: sign in, then enter/select a project.

## Added a mock data layer (session + projects)

```ts
// src/lib/data/session.ts
export const session = writable<{ user: User | null }>(load()); // localStorage-persisted
export function signIn(email: string): User { /* accepts anything, derives a name */ }

// src/lib/data/projects.ts
export const projects = writable<Project[]>(seed);
export function createProject / renameProject / setVisibility / addMember /
  setMemberRole / removeMember / deleteProject / leaveProject / shareLink(id)
```

**Why:** the screens need data and behavior before Omega exists. **Purpose:** a
clean seam — one `session` store and one `projects` store with typed helpers — that
the UI binds to now and that swaps for the Omega client later. **Why this way:**
per the shell reference, permissions/records are Omega's truth; this stand-in
mirrors that shape (projects, members, roles, visibility) so the swap is a data
source change, not a UI rewrite. Sessions persist to localStorage so the flow
survives refresh.

## Built the sign-in screen

```svelte
<!-- src/routes/login/+page.svelte -->
<form onsubmit={submit}> Email + Password → signIn(email) → goto('/projects') </form>
```

**Why:** an entry point is needed. **Purpose:** a very simple, on-brand mock
sign-in. **Why this way:** email + password composed from `Field`/`Input`/`Button`
on an elevated card; any credentials work for now (explicitly labeled), keeping the
focus on the flow rather than real auth.

## Built the project selection screen

```svelte
<!-- src/routes/projects/+page.svelte -->
TopBar (brand · theme · account menu)
"Projects" + New project
row: name · role Badge · visibility · member Avatars · edited · options Menu
```

**Why:** project-first navigation — the user enters a project from here.
**Purpose:** list the user's projects with ownership, last-edited, members, and a
per-row options menu (Open, Copy link, Settings for owners, Leave for members),
plus create. **Why this way:** it composes existing components; the row menu is
gated by `myRole`; sharing is a copied hyperlink (`shareLink`); an `EmptyState`
covers zero projects. A `/projects/[id]` stub makes navigation real without a 404,
and `projects/+layout.ts` sets `ssr = false` since the mock stores are client-only.

## Built create and settings dialogs

```svelte
CreateProjectDialog   — name + access → createProject
ProjectSettingsDialog — rename · visibility · share link · members+roles · delete/leave
```

**Why:** the deeper project actions need dedicated surfaces. **Purpose:**
`CreateProjectDialog` creates; `ProjectSettingsDialog` is the in-depth modal for
privacy, membership, permissions, and destructive actions. **Why this way:** the
settings dialog reads the live project by id (so member edits reflect instantly),
gates every control behind `isOwner`, keeps destructive actions last with an inline
confirm, and offers Leave to non-owners. `Menu`/`Popover` gained a `triggerClass` +
`label` so triggers style correctly without nesting buttons.

## Notes

Feature code (routes, `src/lib/data`, `src/lib/features`) carries markdown
companions per Practice 1; only `src/lib/components/` is exempt. `svelte-check` is
clean (0/0) and the build passes. Next: connect these seams to the Omega backend
and run a full front-to-back test.
