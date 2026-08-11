/**
 * Organization domain types (Omega `organization` capability). Organizations are
 * user-scoped — they span projects and are NOT tied to the selected project — and
 * they feed a resource's `AccessScope.orgIds`.
 */

/** A member's role in an organization (Omega `Role`). */
export type OrgRole = 'owner' | 'admin' | 'member';

/** An organization the caller belongs to. */
export type Organization = {
  id: string;
  name: string;
  /** The caller's role in this org (present on list/create; kept across a rename). */
  role: OrgRole;
  createdAt: number;
  updatedAt: number;
};

/** One organization membership (Omega `memberJSON` — only `userId` + `role`). */
export type OrgMember = {
  userId: string;
  role: OrgRole;
};

/** The roles, highest-privilege first (for role selects). */
export const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'member'];

/** Narrow an arbitrary backend role string to a known `OrgRole` (defaults to member). */
export function toOrgRole(role: string | undefined): OrgRole {
  return role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'member';
}
