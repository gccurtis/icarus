# src/lib/systems/projects/api.ts — breakdown

Companion to [api.ts](api.ts). The projects API client: project CRUD kept in sync with the
`projects` store, role name translation between the UI and Omega, share-link management,
membership management, and the project "names / formulas" layer (fetch, set value, set
function, evaluate, delete). Every function maps the raw Omega wire shape to the UI types
from `./types`.

## Imports

### Import the store accessor, API client, session helpers, project types, and the store

```ts
import { get } from 'svelte/store';
import { api } from '$data/api';
import { session, displayName } from '$data/session';
import type { Role, Member, MemberSummary, ShareLink, IconColor, Visibility, Project } from './types';
import { ICON_COLORS } from './types';
import { projects } from './store';

```

`get` reads a store's value once (outside a reactive context) — used to snapshot the current
`session`. `api` is the base fetch client. `session` holds the signed-in user and `displayName`
derives a friendly name from a name/email pair. The type imports and the `ICON_COLORS`
runtime array come from `./types`, and `projects` is the writable store this module keeps in
sync. The blank line separates imports from the first helper.

## Role mapping

### Translate between UI role names and Omega's wire role names

```ts
function toUiRole(r: string): Role {
  return r === 'edit' ? 'editor' : r === 'read' ? 'viewer' : 'owner';
}

function toOmegaRole(r: Role): string {
  return r === 'editor' ? 'edit' : r === 'viewer' ? 'read' : 'owner';
}

```

Omega speaks `edit`/`read`/`owner`; the UI speaks `editor`/`viewer`/`owner`. `toUiRole` and
`toOmegaRole` are inverse mappings applied at every boundary so the rest of the app only ever
sees UI role names. Anything unrecognized falls back to `owner`. The blank line separates the
role helpers from the user helpers.

## Current user and self-membership

### Resolve the current user id and build a self Member from the session

```ts
export function currentUserId(): string {
  return get(session).user?.id ?? 'u_me';
}

function selfMember(role: Role): Member | null {
  const u = get(session).user;
  return u ? { id: u.id, name: u.name, email: u.email, role } : null;
}

```

`currentUserId` snapshots the session and returns the signed-in user's id, falling back to a
placeholder `'u_me'` when there is no session (e.g. during early boot). `selfMember` builds a
`Member` for the current user at a given role, returning `null` when unauthenticated — used to
seed a freshly-mapped project's member list with the viewer. The blank line separates these
from the wire types.

## Project wire types and mappers

### The raw Omega project and member shapes

```ts
type ApiMemberSummary = { items?: { userId: string; name: string; avatarUrl?: string }[]; total?: number };
type ApiProject = { id: string; name: string; role: string; icon: string; purpose: string; visibility: string; createdAt?: string; updatedAt?: string; members?: ApiMemberSummary };
type ApiMember = { userId: string; name: string; email: string; role: string };

```

The private wire shapes as Omega returns them: `role`, `icon`, and `visibility` are loose
`string`s here, and a member's id arrives as `userId`. `ApiMemberSummary` is the optional
avatar-cluster projection Omega attaches to each project as `members` — a bounded `items`
stack plus a `total`, every field optional. The mappers below narrow and rename these into
the UI types. The blank line separates the types from the member-summary mapper.

`createdAt` / `updatedAt` are typed optional even though Omega always sends them: they were
absent from this type until the context rail needed them, so declaring them optional keeps the
older recorded fixtures (and the tests built on them) honest rather than asserting a field that a
given payload may not carry.

### Map the wire member-summary into the UI MemberSummary

```ts
function toMemberSummary(m: ApiMemberSummary | undefined): MemberSummary {
  return {
    items: (m?.items ?? []).map((it) => ({ userId: it.userId, name: it.name, avatarUrl: it.avatarUrl || undefined })),
    total: m?.total ?? 0
  };
}

```

`toMemberSummary` narrows the optional wire projection to the UI `MemberSummary`: it maps each
item to `{ userId, name, avatarUrl }` (coercing an empty `avatarUrl` to `undefined`) and
defaults a missing `items` to an empty stack and a missing `total` to `0`. The blank line
separates it from the coercion helpers.

### Parse Omega's timestamps to epoch ms

```ts
function toTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}
```

`toTime` is the edge translation for the two project timestamps. Omega sends `createdAt` as
RFC3339 and `updatedAt` as RFC3339Nano — `Date.parse` handles both, truncating the nanosecond
tail to milliseconds. It returns `undefined` (never `0`) for a missing or unparseable value, so
the Properties lens can draw a dash for "not known" instead of confidently rendering 1970.

Both are populated on *every* project response, not just the list: Omega's `oneView` delegates
to the same `views` builder that `GET /projects` uses, so a `POST`, `PATCH`, or join reply carries
them too. That is why `updateProject` below can refresh `updatedAt` from its own response.

### Coerce icon and visibility strings to their union types

```ts
function toIcon(icon: string): IconColor {
  return (ICON_COLORS as string[]).includes(icon) ? (icon as IconColor) : 'focus';
}
function toVisibility(v: string): Visibility {
  return v === 'link' ? 'link' : 'private';
}

```

`toIcon` validates an incoming icon string against the `ICON_COLORS` palette, defaulting to
`'focus'` for anything unknown so the UI never renders an undefined color class.
`toVisibility` collapses the wire value to the two-member `Visibility` union, treating
anything but `'link'` as `'private'`. The blank line separates them from the object mappers.

### Map an API project and API member into their UI shapes

```ts
function toProject(p: ApiProject): Project {
  const role = toUiRole(p.role);
  const self = selfMember(role);
  return {
    id: p.id,
    name: p.name,
    role,
    members: self ? [self] : [],
    memberSummary: toMemberSummary(p.members),
    visibility: toVisibility(p.visibility),
    icon: toIcon(p.icon),
    purpose: p.purpose,
    createdAt: toTime(p.createdAt),
    updatedAt: toTime(p.updatedAt)
  };
}

function toMember(m: ApiMember): Member {
  return { id: m.userId, name: displayName(m.name, m.email), email: m.email, role: toUiRole(m.role) };
}

```

`toProject` converts a wire project to the UI `Project`: it maps the role, seeds `members`
with just the current user (the full roster loads on demand), attaches the bounded
`memberSummary` avatar cluster via `toMemberSummary`, normalizes `visibility` and `icon`, and
parses both timestamps through `toTime`.
`toMember` renames `userId` to `id`, derives a friendly `name` via
`displayName`, and maps the role. The blank line separates the mappers from the CRUD calls.

## Project CRUD

### List projects into the store

```ts
export async function fetchProjects(): Promise<void> {
  const res = await api<{ projects: ApiProject[] }>('/projects');
  projects.set(res.projects.map(toProject));
}

```

`fetchProjects` GETs `/projects`, maps each wire project, and replaces the store's contents
outright — the store mirrors the server's list. The blank line separates it from the
mutating operations.

### Create, delete, leave, and open a project

```ts
export async function createProject(name: string): Promise<string> {
  const p = await api<ApiProject>('/projects', { method: 'POST', body: JSON.stringify({ name }) });
  projects.update((all) => [toProject(p), ...all]);
  return p.id;
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/projects/${id}`, { method: 'DELETE' });
  projects.update((all) => all.filter((p) => p.id !== id));
}

export async function leaveProject(id: string): Promise<void> {
  await api(`/projects/${id}/leave`, { method: 'POST' });
  projects.update((all) => all.filter((p) => p.id !== id));
}

export async function openProject(id: string): Promise<void> {
  await api('/session/project', { method: 'POST', body: JSON.stringify({ projectId: id }) });
}

```

Each mutation optimistically reconciles the store after the server confirms. `createProject`
prepends the new project and returns its id. `deleteProject` and `leaveProject` both remove
the project from the store, differing only in the endpoint (destroy vs. leave). `openProject`
switches the session's active project server-side and touches no store state. The blank line
separates the CRUD block from the share-link layer.

## Share links

### Build a join URL and map an API link to a UI ShareLink

```ts
function linkUrl(token: string): string {
  const base = typeof location !== 'undefined' ? location.origin : 'https://taurus.app';
  return `${base}/join/${token}`;
}

type ApiLink = { role: string; token: string };
function toShareLink(l: ApiLink): ShareLink {
  return { role: l.role === 'edit' ? 'edit' : 'read', token: l.token, url: linkUrl(l.token) };
}

```

`linkUrl` composes the shareable `/join/:token` URL from the current origin, falling back to
the production host when `location` is unavailable (SSR). `ApiLink` is the wire shape, and
`toShareLink` maps it to the UI `ShareLink`, clamping the role to `edit`/`read` and
precomputing the full `url`. The blank line separates the helpers from the link operations.

### Fetch, rotate, and disable share links

```ts
export async function fetchLinks(projectId: string): Promise<ShareLink[]> {
  const res = await api<{ links: ApiLink[] }>(`/projects/${projectId}/links`);
  return res.links.map(toShareLink);
}

export async function rotateLink(projectId: string, role: 'read' | 'edit'): Promise<ShareLink> {
  const l = await api<ApiLink>(`/projects/${projectId}/links/${role}`, { method: 'PUT' });
  return toShareLink(l);
}

export async function disableLink(projectId: string, role: 'read' | 'edit'): Promise<void> {
  await api(`/projects/${projectId}/links/${role}`, { method: 'DELETE' });
}

```

`fetchLinks` lists a project's share links (one per role) as UI shapes. `rotateLink` PUTs to
mint or regenerate the token for a given role and returns the fresh link. `disableLink`
DELETEs a role's link so the token stops working. The blank line separates these from the
join flow.

### Join a project by share token

```ts
export async function joinByToken(token: string): Promise<string> {
  const p = await api<ApiProject>(`/join/${token}`, { method: 'POST' });
  await fetchProjects();
  return p.id;
}

```

`joinByToken` POSTs a share token to accept an invitation, then re-runs `fetchProjects` so the
newly-joined project appears in the store, returning its id for navigation. The blank line
separates it from the update/membership block.

## Project updates and membership

### Patch a project's editable fields and reconcile the store

```ts
export async function updateProject(
  id: string,
  changes: { name?: string; icon?: IconColor; visibility?: Visibility; purpose?: string }
): Promise<void> {
  const p = await api<ApiProject>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  projects.update((all) => all.map((x) => x.id === id ? { ...x, name: p.name, icon: toIcon(p.icon), visibility: toVisibility(p.visibility), purpose: p.purpose, updatedAt: toTime(p.updatedAt) ?? x.updatedAt } : x));
}

```

`updateProject` PATCHes any subset of a project's editable fields, then merges the server's
authoritative response back into the matching store entry (re-normalizing `icon` and
`visibility`). The role and members are left untouched since this endpoint does not change
them. `updatedAt` is refreshed from the response so the Properties lens's "Last activity" moves
when you rename or re-share a project, and falls back to the value already held (`?? x.updatedAt`)
rather than blanking the field if a response ever omits it. The blank line separates it from the
membership calls.

### Fetch members, add a member, change a role, and remove a member

```ts
export async function fetchMembers(projectId: string): Promise<Member[]> {
  const res = await api<{ members: ApiMember[] }>(`/projects/${projectId}/members`);
  return res.members.map(toMember);
}

export async function addMember(projectId: string, email: string, role: Role): Promise<Member> {
  const m = await api<ApiMember>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email: email.trim(), role: toOmegaRole(role) }) });
  return toMember(m);
}

export async function setMemberRole(projectId: string, userId: string, role: Role): Promise<void> {
  await api(`/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role: toOmegaRole(role) }) });
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
}

```

The full membership roster is fetched separately from the project list (which only carries
the self-member). `fetchMembers` maps the roster to UI `Member`s. `addMember` POSTs a trimmed
email and Omega role, returning the created member. `setMemberRole` PATCHes a member's role,
and `removeMember` DELETEs them; both translate the UI role to Omega's wire name. The blank
line separates membership from the names layer.

## Project names and formulas

### The NamesEntry type — a named value or stored formula

```ts
// --- project names / formulas -----------------------------------------------

export type NamesEntry = {
  name: string;
  type: 'null' | 'number' | 'text' | 'logic' | 'table' | 'function';
  value: unknown;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

```

A project can hold named values and formulas that documents reference. `NamesEntry` is a
single such name: its `type` is the resolved value kind (or `function` for a stored formula),
`value` is the current resolved value, and `source` is the formula text when it is a function.
Timestamps stay as raw ISO strings here. The blank line separates the type from its client
functions.

### Fetch all names for a project

```ts
export async function fetchProjectNames(projectId: string): Promise<NamesEntry[]> {
  const res = await api<{ names: NamesEntry[] }>(`/projects/${projectId}/names`);
  return res.names;
}

```

`fetchProjectNames` GETs `/projects/:id/names` and returns the entries as-is (the wire shape
already matches `NamesEntry`). The blank line separates it from the setters.

### Store a literal value or a formula under a name

```ts
const SCALAR_SHAPE = { fields: 1, rows: 1 };

export function taggedValue(value: unknown): Record<string, unknown> {
  const shape = { ...SCALAR_SHAPE };
  if (value === null || value === undefined) return { kind: 'null', shape };
  if (typeof value === 'boolean') return { kind: 'logic', shape, logic: value };
  …
}
```

Both setters are upserts (PUT), so they create or overwrite by name — there is no separate
rename. `setNameFunction` stores a formula's `source` text at `…/function`; the name is
URL-encoded in both.

**`setNameValue` must send a TAGGED value, and did not (fixed 2026-07-27).** Omega decodes the
body into a `formula.Value`, whose `UnmarshalJSON` requires:

- `kind` — `null` / `number` / `text` / `logic` for a scalar;
- exactly the **one** payload field that kind allows, and no other (`DisallowUnknownFields`);
- `shape`, which is **mandatory** and must equal the payload's own shape —
  `if (raw.Shape == nil || *raw.Shape != decoded.Shape())` is a hard error. Every scalar is a
  1×1, hence `{ fields: 1, rows: 1 }`.

A number travels as a **string**, because formula arithmetic is exact rational and must never
round-trip through a binary float.

This used to send the bare scalar (`42`, `"text"`, `true`), which Omega rejects with
`400 invalid JSON body` — so creating a literal name value could never have succeeded. All four
scalar kinds were verified against a live backend before the shape was settled. The blank line
separates the setters from evaluate/delete.

### Evaluate an expression and delete a name

```ts
export async function evaluateExpression(
  projectId: string,
  source: string
): Promise<{ value: string; type: string }> {
  return api<{ value: string; type: string }>(`/projects/${projectId}/evaluate`, {
    method: 'POST',
    body: JSON.stringify({ source })
  });
}

export async function deleteProjectName(projectId: string, name: string): Promise<void> {
  await api(`/projects/${projectId}/names/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
```

`evaluateExpression` POSTs a formula's `source` to `/projects/:id/evaluate` and returns its
computed `value` and `type` without storing anything — used to power the live preview in the
name manager. `deleteProjectName` DELETEs a name (URL-encoded) from the project.
