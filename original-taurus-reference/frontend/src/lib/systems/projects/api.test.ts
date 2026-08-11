import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$data/api', () => ({
  api: vi.fn()
}));

import { api } from '$data/api';

describe('project member summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the members {items,total} summary from GET /projects', async () => {
    const { fetchProjects } = await import('./api');
    const { projects } = await import('./store');
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      projects: [
        {
          id: 'p1', name: 'Alpha', role: 'owner', icon: 'focus', purpose: '', visibility: 'private',
          members: { items: [{ userId: 'u1', name: 'Ada', avatarUrl: 'http://x/a.png' }, { userId: 'u2', name: 'Bo' }], total: 7 }
        }
      ]
    });
    await fetchProjects();
    expect(get(projects)[0].memberSummary).toEqual({
      items: [
        { userId: 'u1', name: 'Ada', avatarUrl: 'http://x/a.png' },
        { userId: 'u2', name: 'Bo', avatarUrl: undefined }
      ],
      total: 7
    });
  });

  it('defaults to an empty summary when GET /projects omits members', async () => {
    const { fetchProjects } = await import('./api');
    const { projects } = await import('./store');
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      projects: [{ id: 'p2', name: 'Beta', role: 'edit', icon: 'x', purpose: '', visibility: 'private' }]
    });
    await fetchProjects();
    expect(get(projects).find((p) => p.id === 'p2')?.memberSummary).toEqual({ items: [], total: 0 });
  });
});

describe('project timestamps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses createdAt (RFC3339) and updatedAt (RFC3339Nano) to epoch ms', async () => {
    const { fetchProjects } = await import('./api');
    const { projects } = await import('./store');
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      projects: [
        {
          id: 'p3', name: 'Gamma', role: 'owner', icon: 'focus', purpose: '', visibility: 'private',
          createdAt: '2026-07-12T09:30:00Z',
          updatedAt: '2026-07-29T14:05:06.123456789Z'
        }
      ]
    });
    await fetchProjects();
    const p = get(projects).find((x) => x.id === 'p3');
    expect(p?.createdAt).toBe(Date.parse('2026-07-12T09:30:00Z'));
    expect(p?.updatedAt).toBe(Date.parse('2026-07-29T14:05:06.123Z'));
  });

  it('leaves both undefined when absent or unparseable — never 1970', async () => {
    const { fetchProjects } = await import('./api');
    const { projects } = await import('./store');
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      projects: [{ id: 'p4', name: 'Delta', role: 'read', icon: 'focus', purpose: '', visibility: 'private', updatedAt: 'not-a-date' }]
    });
    await fetchProjects();
    const p = get(projects).find((x) => x.id === 'p4');
    expect(p?.createdAt).toBeUndefined();
    expect(p?.updatedAt).toBeUndefined();
  });
});

describe('names API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchProjectNames', () => {
    it('fetches and returns names from the project', async () => {
      const { fetchProjectNames } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockResolvedValueOnce({
        names: [
          { name: 'target_system', type: 'text', value: 'Kepler-186', createdAt: '', updatedAt: '' },
          { name: 'distance_ly', type: 'number', value: 580, createdAt: '', updatedAt: '' }
        ]
      });

      const names = await fetchProjectNames('proj-1');
      expect(names).toHaveLength(2);
      expect(names[0].name).toBe('target_system');
      expect(names[0].type).toBe('text');
      expect(names[0].value).toBe('Kepler-186');
      expect(names[1].type).toBe('number');
      expect(names[1].value).toBe(580);
    });

    it('handles empty names list', async () => {
      const { fetchProjectNames } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockResolvedValueOnce({ names: [] });

      const names = await fetchProjectNames('proj-1');
      expect(names).toHaveLength(0);
    });

    it('propagates API errors', async () => {
      const { fetchProjectNames } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockRejectedValueOnce({ status: 500, message: 'server error' });

      await expect(fetchProjectNames('proj-1')).rejects.toEqual({ status: 500, message: 'server error' });
    });
  });

  describe('evaluateExpression', () => {
    it('evaluates a formula and returns the result', async () => {
      const { evaluateExpression } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockResolvedValueOnce({ value: '177.83', type: 'number' });

      const result = await evaluateExpression('proj-1', '=distance_ly * 0.306601');
      expect(result.value).toBe('177.83');
      expect(result.type).toBe('number');
      expect(mockApi).toHaveBeenCalledWith('/projects/proj-1/evaluate', {
        method: 'POST',
        body: JSON.stringify({ source: '=distance_ly * 0.306601' })
      });
    });

    it('propagates evaluation errors', async () => {
      const { evaluateExpression } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockRejectedValueOnce({ status: 400, message: 'invalid expression' });

      await expect(evaluateExpression('proj-1', '=bad')).rejects.toEqual({ status: 400, message: 'invalid expression' });
    });
  });

  describe('setNameFunction', () => {
    it('sends the function source to Omega', async () => {
      const { setNameFunction } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockResolvedValueOnce(undefined);

      await setNameFunction('proj-1', 'my_formula', '=x * 2');
      expect(mockApi).toHaveBeenCalledWith('/projects/proj-1/names/my_formula/function', {
        method: 'PUT',
        body: JSON.stringify({ source: '=x * 2' })
      });
    });

    it('URL-encodes the name parameter', async () => {
      const { setNameFunction } = await import('./api');
      const mockApi = api as ReturnType<typeof vi.fn>;
      mockApi.mockResolvedValueOnce(undefined);

      await setNameFunction('proj-1', 'my name with spaces', '=1');
      expect(mockApi).toHaveBeenCalledWith('/projects/proj-1/names/my%20name%20with%20spaces/function', {
        method: 'PUT',
        body: JSON.stringify({ source: '=1' })
      });
    });
  });
});
