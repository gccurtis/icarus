import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.fn();
vi.mock('$data/api', () => ({ api: (path: string, init?: RequestInit) => apiMock(path, init) }));

import { get } from 'svelte/store';
import { organizations } from './store';
import {
  loadOrganizations,
  createOrganization,
  renameOrganization,
  fetchOrgMembers,
  addOrgMember,
  setOrgMemberRole,
  removeOrgMember
} from './api';

beforeEach(() => {
  apiMock.mockReset();
  organizations.set([]);
});

describe('organization client', () => {
  it('loads the caller’s organizations (wrapped list)', async () => {
    apiMock.mockResolvedValue({
      organizations: [{ id: 'o1', name: 'Acme', role: 'owner', createdAt: '2026-07-26', updatedAt: '2026-07-26' }]
    });
    await loadOrganizations();
    expect(apiMock).toHaveBeenCalledWith('/organizations', undefined);
    expect(get(organizations)[0]).toMatchObject({ id: 'o1', name: 'Acme', role: 'owner' });
  });

  it('creates an org and prepends it to the store', async () => {
    apiMock.mockResolvedValue({ id: 'o2', name: 'New', role: 'owner', createdAt: '2026-07-26', updatedAt: '2026-07-26' });
    const org = await createOrganization('New');
    expect(apiMock).toHaveBeenCalledWith('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'New' })
    });
    expect(org.role).toBe('owner');
    expect(get(organizations)[0].id).toBe('o2');
  });

  it('rename keeps the known role even though the response omits it', async () => {
    organizations.set([{ id: 'o1', name: 'Old', role: 'admin', createdAt: 0, updatedAt: 0 }]);
    apiMock.mockResolvedValue({ id: 'o1', name: 'Renamed', createdAt: '2026-07-26', updatedAt: '2026-07-27' });
    await renameOrganization('o1', 'Renamed');
    expect(apiMock).toHaveBeenCalledWith('/organizations/o1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed' })
    });
    const org = get(organizations)[0];
    expect(org.name).toBe('Renamed');
    expect(org.role).toBe('admin'); // preserved (response has no role)
  });

  it('lists members', async () => {
    apiMock.mockResolvedValue({ members: [{ userId: 'u1', role: 'member' }] });
    const members = await fetchOrgMembers('o1');
    expect(apiMock).toHaveBeenCalledWith('/organizations/o1/members', undefined);
    expect(members).toEqual([{ userId: 'u1', role: 'member' }]);
  });

  it('adds a member by userId + role', async () => {
    apiMock.mockResolvedValue({ userId: 'u9', role: 'admin' });
    const m = await addOrgMember('o1', 'u9', 'admin');
    expect(apiMock).toHaveBeenCalledWith('/organizations/o1/members', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u9', role: 'admin' })
    });
    expect(m).toEqual({ userId: 'u9', role: 'admin' });
  });

  it('sets a member role and removes a member on the nested routes', async () => {
    apiMock.mockResolvedValue(undefined);
    await setOrgMemberRole('o1', 'u9', 'member');
    expect(apiMock).toHaveBeenCalledWith('/organizations/o1/members/u9', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'member' })
    });
    await removeOrgMember('o1', 'u9');
    expect(apiMock).toHaveBeenCalledWith('/organizations/o1/members/u9', { method: 'DELETE' });
  });
});
