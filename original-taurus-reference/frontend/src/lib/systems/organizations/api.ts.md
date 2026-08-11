# src/lib/systems/organizations/api.ts — breakdown

Companion to [api.ts](api.ts). The organizations API client: it wraps Omega's `organization` endpoints, translates the wire shapes (`orgJSON` / `memberJSON`) into the UI-facing domain types at the data boundary, and keeps the `organizations` store in sync on load, create, and rename. Member operations return values to the caller rather than caching them.

## Imports

### Import the API client, org types, the role narrower, and the store

```ts
import { api } from '$data/api';
import type { Organization, OrgMember, OrgRole } from './types';
import { toOrgRole } from './types';
import { organizations } from './store';

```

The module pulls in the shared `api` fetch client, the domain types it maps to, the `toOrgRole` narrowing guard used on every backend role string, and the `organizations` store it mutates. The blank line separates imports from the wire-shape declarations.

## Wire shapes

### The Omega row types for an organization and a member

```ts
// Wire shapes (Omega `orgJSON` / `memberJSON`). `role` is omitted on rename.
type ApiOrg = { id: string; name: string; role?: string; createdAt: string; updatedAt: string };
type ApiMember = { userId: string; role: string };

```

`ApiOrg` and `ApiMember` are the raw JSON shapes Omega returns — never exported. They differ from the domain types in two ways the mappers reconcile: timestamps arrive as ISO strings (not numbers), and `role` is an untyped string that is optional on `ApiOrg` because the rename response omits it.

## Wire → domain mappers

### Convert an API org or member into its UI-facing type

```ts
function toOrg(o: ApiOrg): Organization {
  return {
    id: o.id,
    name: o.name,
    role: toOrgRole(o.role),
    createdAt: Date.parse(o.createdAt),
    updatedAt: Date.parse(o.updatedAt)
  };
}

function toMember(m: ApiMember): OrgMember {
  return { userId: m.userId, role: toOrgRole(m.role) };
}

```

`toOrg` narrows the loose `role` string to an `OrgRole` and parses both ISO timestamps into numeric epoch millis, so the rest of the app works with the shape-stable `Organization`. `toMember` does the same role-narrowing for a membership. Centralizing the translation here is the AGENTS.md "map at the edge" rule — components only ever see clean domain types.

## Loading and creating organizations

### Load the caller's orgs into the store, and create a new one

```ts
/** Load the caller's organizations into the store (`GET /organizations`). */
export async function loadOrganizations(): Promise<void> {
  const res = await api<{ organizations: ApiOrg[] }>('/organizations');
  organizations.set((res.organizations ?? []).map(toOrg));
}

/** Create a new organization; the caller becomes its owner (`POST /organizations`). */
export async function createOrganization(name: string): Promise<Organization> {
  const org = toOrg(
    await api<ApiOrg>('/organizations', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
  );
  organizations.update((list) => [org, ...list.filter((o) => o.id !== org.id)]);
  return org;
}

```

`loadOrganizations` GETs the list, maps each row through `toOrg`, and replaces the store contents (defaulting to `[]` when Omega omits the array). `createOrganization` POSTs a trimmed name — the backend makes the caller the owner — then prepends the new org to the store, filtering any existing entry with the same id so a re-create can't duplicate a row. It also returns the org so the dialog can immediately select it.

## Renaming

### Rename an organization, preserving the caller's known role

```ts
/**
 * Rename an organization (owner/admin). The response omits the caller's role, so the
 * store keeps the role it already knows and updates only name + timestamp.
 */
export async function renameOrganization(orgId: string, name: string): Promise<void> {
  const org = toOrg(
    await api<ApiOrg>(`/organizations/${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim() })
    })
  );
  organizations.update((list) =>
    list.map((o) => (o.id === orgId ? { ...o, name: org.name, updatedAt: org.updatedAt } : o))
  );
}

```

`renameOrganization` PATCHes a trimmed name to the org's URL (the id is URL-encoded). Because the rename response carries no `role`, the store update copies only `name` and `updatedAt` onto the existing row via spread — preserving the role the client already knew instead of overwriting it with the narrower's `member` default. The org id path segment is `encodeURIComponent`-escaped throughout this file so ids with reserved characters route correctly.

## Member operations

### List, add, change-role, and remove members

```ts
/** List an organization's members (`GET /organizations/:orgID/members`). */
export async function fetchOrgMembers(orgId: string): Promise<OrgMember[]> {
  const res = await api<{ members: ApiMember[] }>(`/organizations/${encodeURIComponent(orgId)}/members`);
  return (res.members ?? []).map(toMember);
}

/** Add a member by user id (`POST /organizations/:orgID/members`). Role is required. */
export async function addOrgMember(orgId: string, userId: string, role: OrgRole): Promise<OrgMember> {
  return toMember(
    await api<ApiMember>(`/organizations/${encodeURIComponent(orgId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId.trim(), role })
    })
  );
}

/** Change a member's role (`PATCH /organizations/:orgID/members/:userID`, 204). */
export async function setOrgMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
  await api(`/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

/** Remove a member (`DELETE /organizations/:orgID/members/:userID`, 204). */
export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await api(`/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
}
```

These four functions cover the membership lifecycle and, unlike the org functions, do not touch the store — the dialog owns member state locally. `fetchOrgMembers` GETs and maps the roster. `addOrgMember` POSTs a trimmed user id plus role and returns the created membership. `setOrgMemberRole` and `removeOrgMember` PATCH and DELETE against the member sub-resource and resolve to `void`, since Omega answers both with a bodyless `204`. Every path interpolates both the org id and the user id through `encodeURIComponent`.
