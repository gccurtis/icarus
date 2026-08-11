import { api } from '$data/api';
import type { Organization, OrgMember, OrgRole } from './types';
import { toOrgRole } from './types';
import { organizations } from './store';

// Wire shapes (Omega `orgJSON` / `memberJSON`). `role` is omitted on rename.
type ApiOrg = { id: string; name: string; role?: string; createdAt: string; updatedAt: string };
type ApiMember = { userId: string; role: string };

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
