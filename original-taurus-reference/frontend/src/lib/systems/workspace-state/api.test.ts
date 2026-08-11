import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.fn();
vi.mock('$data/api', () => ({ api: (path: string, init?: RequestInit) => apiMock(path, init) }));

import { getWorkspaceState, putWorkspaceState } from './api';

beforeEach(() => apiMock.mockReset());

describe('workspace-state client', () => {
  it('returns null when nothing is saved (updatedAt null)', async () => {
    apiMock.mockResolvedValue({ updatedAt: null });
    expect(await getWorkspaceState()).toBeNull();
    expect(apiMock).toHaveBeenCalledWith('/workspace', undefined);
  });

  it('strips updatedAt and returns the stored state', async () => {
    apiMock.mockResolvedValue({ tabs: [{ id: 'x' }], activeTabId: 'x', updatedAt: '2026-07-26' });
    expect(await getWorkspaceState()).toEqual({ tabs: [{ id: 'x' }], activeTabId: 'x' });
  });

  it('PUTs the whole state as the body', async () => {
    apiMock.mockResolvedValue({ updatedAt: '2026-07-26' });
    await putWorkspaceState({ tabs: [], activeTabId: 'overview' });
    expect(apiMock).toHaveBeenCalledWith('/workspace', {
      method: 'PUT',
      body: JSON.stringify({ tabs: [], activeTabId: 'overview' })
    });
  });
});
