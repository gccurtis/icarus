import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$data/api', () => ({
  api: vi.fn(),
  isApiError: (e: unknown) => typeof e === 'object' && e !== null && 'status' in e
}));

import { api } from '$data/api';
import { roster, loadRoster, resetRoster, byAccess, ownerOf } from './roster';
import type { Member } from './types';

const member = (id: string, name: string, role: Member['role']): Member => ({
  id,
  name,
  email: `${id}@example.com`,
  role
});

const mockApi = api as ReturnType<typeof vi.fn>;

describe('byAccess', () => {
  it('orders owner, then editors, then viewers, alphabetically within a role', () => {
    const ordered = byAccess([
      member('u4', 'Cy', 'viewer'),
      member('u2', 'Zoe', 'editor'),
      member('u1', 'Ada', 'owner'),
      member('u3', 'Bo', 'editor'),
      member('u5', 'Al', 'viewer')
    ]);
    expect(ordered.map((m) => m.name)).toEqual(['Ada', 'Bo', 'Zoe', 'Al', 'Cy']);
  });

  it('does not mutate its input', () => {
    const input = [member('u2', 'Bo', 'viewer'), member('u1', 'Ada', 'owner')];
    byAccess(input);
    expect(input.map((m) => m.name)).toEqual(['Bo', 'Ada']);
  });
});

describe('ownerOf', () => {
  it('finds the owner', () => {
    expect(ownerOf([member('u1', 'Bo', 'editor'), member('u2', 'Ada', 'owner')])?.name).toBe('Ada');
  });

  it('is null when no owner is present', () => {
    expect(ownerOf([member('u1', 'Bo', 'editor')])).toBeNull();
  });
});

describe('loadRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRoster();
  });

  it('loads the roster and marks it ready', async () => {
    mockApi.mockResolvedValueOnce({ members: [{ userId: 'u1', name: 'Ada', email: 'ada@x.io', role: 'owner' }] });
    await loadRoster('p1');
    expect(get(roster).status).toBe('ready');
    expect(get(roster).projectId).toBe('p1');
    expect(get(roster).members).toHaveLength(1);
  });

  it('serves a second read of the same project from cache', async () => {
    mockApi.mockResolvedValueOnce({ members: [] });
    await loadRoster('p1');
    await loadRoster('p1');
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when forced', async () => {
    mockApi.mockResolvedValue({ members: [] });
    await loadRoster('p1');
    await loadRoster('p1', true);
    expect(mockApi).toHaveBeenCalledTimes(2);
  });

  it('replaces the roster when the project changes', async () => {
    mockApi.mockResolvedValueOnce({ members: [{ userId: 'u1', name: 'Ada', email: 'a@x.io', role: 'owner' }] });
    await loadRoster('p1');
    mockApi.mockResolvedValueOnce({ members: [{ userId: 'u2', name: 'Bo', email: 'b@x.io', role: 'edit' }] });
    await loadRoster('p2');
    expect(get(roster).projectId).toBe('p2');
    expect(get(roster).members.map((m) => m.name)).toEqual(['Bo']);
  });

  it('drops a late response for a project the user has left', async () => {
    let release: (value: { members: unknown[] }) => void = () => {};
    mockApi.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const inFlight = loadRoster('p1');

    mockApi.mockResolvedValueOnce({ members: [{ userId: 'u2', name: 'Bo', email: 'b@x.io', role: 'edit' }] });
    await loadRoster('p2');

    release({ members: [{ userId: 'u1', name: 'Ada', email: 'a@x.io', role: 'owner' }] });
    await inFlight;

    expect(get(roster).projectId).toBe('p2');
    expect(get(roster).members.map((m) => m.name)).toEqual(['Bo']);
  });

  it('records an error message without clearing the project it belongs to', async () => {
    mockApi.mockRejectedValueOnce({ status: 403, message: 'forbidden' });
    await loadRoster('p1');
    expect(get(roster).status).toBe('error');
    expect(get(roster).error).toBe('forbidden');
    expect(get(roster).projectId).toBe('p1');
  });
});
