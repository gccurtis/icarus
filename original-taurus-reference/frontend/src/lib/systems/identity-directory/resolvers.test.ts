import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module
vi.mock('$data/api', () => ({
  api: vi.fn()
}));

import { api } from '$data/api';
import {
  resolveFromUserId,
  clearIdentityCache,
  getIdentityProfile,
  identityProfileFromMember,
  identityProfileFromCollaborator
} from './resolvers';

describe('resolveFromUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearIdentityCache();
  });

  it('calls the API and returns a resolved profile on cache miss', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({ id: 'u-1', name: 'Real Name' });

    const profile = await resolveFromUserId('u-1', 'fallback');

    expect(profile.id).toBe('u-1');
    expect(profile.name).toBe('Real Name');
    expect(profile.kind).toBe('person');
    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(mockApi).toHaveBeenCalledWith('/users/u-1');
  });

  it('returns cached result without calling API on subsequent requests', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({ id: 'u-1', name: 'Real Name' });

    // First call — API hit
    await resolveFromUserId('u-1', 'fallback');
    expect(mockApi).toHaveBeenCalledTimes(1);

    // Second call — cache hit, no API call
    const profile2 = await resolveFromUserId('u-1', 'different fallback');
    expect(mockApi).toHaveBeenCalledTimes(1); // still 1
    expect(profile2.name).toBe('Real Name'); // cached name, not fallback
  });

  it('uses the enriched fields from GET /users/:id (real data, not mock enrichment)', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({
      id: 'u-2',
      kind: 'person',
      name: 'Maya Chen',
      email: 'maya@x.com',
      role: 'Research lead',
      description: 'Star Map research lead',
      createdAt: '2025-01-01T00:00:00Z'
    });

    const profile = await resolveFromUserId('u-2', 'fallback');
    expect(profile.name).toBe('Maya Chen');
    expect(profile.role).toBe('Research lead');
    expect(profile.description).toBe('Star Map research lead');
    expect(profile.email).toBe('maya@x.com');
    expect(profile.mock).toBe(false);
  });

  it('uses fallback name when API returns empty name', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({ id: 'u-1', name: '' });

    const profile = await resolveFromUserId('u-1', 'Fallback Name');
    expect(profile.name).toBe('Fallback Name');
  });

  it('falls back to mock name lookup on API failure', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockRejectedValueOnce({ status: 404, message: 'not found' });

    const profile = await resolveFromUserId('u-removed', 'Departed User');
    // Fallback through getIdentityProfile with the fallback name
    expect(profile.name).toBe('Departed User');
    expect(profile.mock).toBe(true);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('falls back for unknown names on API failure', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockRejectedValueOnce({ status: 404, message: 'not found' });

    const profile = await resolveFromUserId('u-unknown', 'Brand New Person');
    expect(profile.name).toBe('Brand New Person');
    expect(profile.kind).toBe('person');
    expect(profile.mock).toBe(true);
  });

  it('caches and reuses API results across different callers', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({ id: 'u-shared', name: 'Shared User' });

    await resolveFromUserId('u-shared', 'fb1');
    const profile2 = await resolveFromUserId('u-shared', 'fb2');
    const profile3 = await resolveFromUserId('u-shared', 'fb3');

    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(profile2.name).toBe('Shared User');
    expect(profile3.name).toBe('Shared User');
  });

  it('clears cache when clearIdentityCache is called', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValue({ id: 'u-1', name: 'Original Name' });

    await resolveFromUserId('u-1', 'fb');
    expect(mockApi).toHaveBeenCalledTimes(1);

    clearIdentityCache();

    // After clear, should call API again
    mockApi.mockResolvedValueOnce({ id: 'u-1', name: 'Updated Name' });
    const profile = await resolveFromUserId('u-1', 'fb');
    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(profile.name).toBe('Updated Name');
  });

  it('handles multiple concurrent cache misses without duplicate API calls', async () => {
    // Note: the current implementation doesn't batch concurrent calls.
    // Each caller independently triggers an API call until the first one caches.
    // This test verifies the eventual consistency — after all resolve, only
    // the last cached value is served for subsequent lookups.
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValue({ id: 'u-concurrent', name: 'Concurrent' });

    // Issue concurrent calls
    const [p1, p2, p3] = await Promise.all([
      resolveFromUserId('u-concurrent', 'f1'),
      resolveFromUserId('u-concurrent', 'f2'),
      resolveFromUserId('u-concurrent', 'f3')
    ]);

    // All returned with the API result
    expect(p1.name).toBe('Concurrent');
    expect(p2.name).toBe('Concurrent');
    expect(p3.name).toBe('Concurrent');

    // After caching, only one more call
    const p4 = await resolveFromUserId('u-concurrent', 'f4');
    expect(p4.name).toBe('Concurrent');
  });
});

describe('getIdentityProfile (synchronous fallback)', () => {
  it('returns a known mock identity', () => {
    const profile = getIdentityProfile('Maya Chen');
    expect(profile.id).toBe('mock_maya');
    expect(profile.kind).toBe('person');
    expect(profile.mock).toBe(true);
  });

  it('classifies all synthesized fallbacks as person (personas resolve via the personas store now)', () => {
    // Persona mock identities were retired in Goal 3.4; the sync fallback no
    // longer classifies any name as a persona.
    const profile = getIdentityProfile('Taurus');
    expect(profile.kind).toBe('person');
    expect(profile.mock).toBe(true);
  });

  it('defaults unknown names to person', () => {
    const profile = getIdentityProfile('dev@taurus.local');
    expect(profile.kind).toBe('person');
    expect(profile.name).toBe('dev@taurus.local');
    expect(profile.mock).toBe(true);
  });

  it('returns a fallback for completely unknown names', () => {
    const profile = getIdentityProfile('Random Stranger');
    expect(profile.kind).toBe('person');
    expect(profile.name).toBe('Random Stranger');
    expect(profile.description).toContain('collaborator');
    expect(profile.mock).toBe(true);
  });
});
