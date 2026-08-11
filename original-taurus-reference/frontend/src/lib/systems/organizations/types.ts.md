# src/lib/systems/organizations/types.ts — breakdown

Companion to [types.ts](types.ts). The organization domain types for Omega's `organization` capability. Organizations are user-scoped — they span projects rather than belonging to the selected one — and their ids feed a resource's `AccessScope.orgIds`. The file defines the role union, the organization and membership records, and two small helpers (an ordered role list and a backend-role narrower).

## Module overview and the role type

### File doc-comment and the member-role union

```ts
/**
 * Organization domain types (Omega `organization` capability). Organizations are
 * user-scoped — they span projects and are NOT tied to the selected project — and
 * they feed a resource's `AccessScope.orgIds`.
 */

/** A member's role in an organization (Omega `Role`). */
export type OrgRole = 'owner' | 'admin' | 'member';

```

The module comment fixes the domain boundary: these types mirror Omega's `organization` capability, and the user-scoped note explains why the store lives outside the project-scoped stores. `OrgRole` is a three-value union — the only roles Omega recognizes — used throughout the system for badges, role selects, and permission checks.

## The organization record

### The Organization type the caller belongs to

```ts
/** An organization the caller belongs to. */
export type Organization = {
  id: string;
  name: string;
  /** The caller's role in this org (present on list/create; kept across a rename). */
  role: OrgRole;
  createdAt: number;
  updatedAt: number;
};

```

`Organization` is the UI-facing record: identity, display name, the caller's own role, and numeric (parsed) timestamps. The `role` field is annotated because Omega returns it on list and create but omits it on rename — the API layer deliberately keeps the previously known role rather than dropping it on a rename response.

## Membership

### One organization membership

```ts
/** One organization membership (Omega `memberJSON` — only `userId` + `role`). */
export type OrgMember = {
  userId: string;
  role: OrgRole;
};

```

`OrgMember` mirrors Omega's `memberJSON`, which carries only a user id and a role — no name or email. The dialog enriches the id into a display name separately via the identity directory; this type stays faithful to what the backend actually returns rather than inventing fields the API does not send.

## Role helpers

### The ordered role list and the backend-role narrower

```ts
/** The roles, highest-privilege first (for role selects). */
export const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'member'];

/** Narrow an arbitrary backend role string to a known `OrgRole` (defaults to member). */
export function toOrgRole(role: string | undefined): OrgRole {
  return role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'member';
}
```

`ORG_ROLES` lists the roles highest-privilege first so role `<select>`s render in a predictable order. `toOrgRole` is the narrowing guard the API layer uses at the data boundary: any unexpected or missing string from the backend collapses to the least-privileged `member`, so the rest of the app only ever handles a valid `OrgRole`.
