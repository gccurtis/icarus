import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.fn();
vi.mock('$data/api', () => ({
  api: (path: string, init?: RequestInit) => apiMock(path, init),
  isApiError: () => false
}));
vi.mock('$data/project-retry', () => ({ withProject: (_p: string, fn: () => unknown) => fn() }));

import { get } from 'svelte/store';
import { resources } from './store';
import { setResourcePinned, setResourceAccess, createResourceFromTemplate } from './api';
import type { Resource } from './types';

const doc = (over: Partial<Resource> = {}): Resource => ({
  id: 'd1',
  name: 'Doc',
  kind: 'document',
  updatedAt: 0,
  createdAt: 0,
  pinned: false,
  access: { projectWide: true, orgIds: [], userIds: [] },
  ...over
});

beforeEach(() => {
  apiMock.mockReset();
  resources.set([]);
});

describe('resource attributes + access', () => {
  it('pins a document via PATCH /attributes and refreshes the store', async () => {
    resources.set([doc()]);
    apiMock.mockResolvedValue({
      id: 'd1', kind: 'document', name: 'Doc', createdAt: '', updatedAt: '2026-07-26',
      pinned: true, access: { projectWide: true }
    });
    await setResourcePinned('d1', true);
    expect(apiMock).toHaveBeenCalledWith('/resources/document/d1/attributes', {
      method: 'PATCH',
      body: JSON.stringify({ pinned: true })
    });
    expect(get(resources)[0].pinned).toBe(true);
  });

  it('sets access via PATCH /access, wrapping the scope in `access`', async () => {
    resources.set([doc()]);
    const access = { projectWide: false, orgIds: [], userIds: ['u2'] };
    apiMock.mockResolvedValue({
      id: 'd1', kind: 'document', name: 'Doc', createdAt: '', updatedAt: '2026-07-26',
      pinned: false, access
    });
    await setResourceAccess('d1', access);
    expect(apiMock).toHaveBeenCalledWith('/resources/document/d1/access', {
      method: 'PATCH',
      body: JSON.stringify({ access })
    });
    expect(get(resources)[0].access.userIds).toEqual(['u2']);
  });

  it('defaults a missing access payload to project-wide', async () => {
    resources.set([doc({ access: { projectWide: false, orgIds: [], userIds: ['u9'] } })]);
    apiMock.mockResolvedValue({
      id: 'd1', kind: 'document', name: 'Doc', createdAt: '', updatedAt: '2026-07-26'
      // no pinned / access fields
    });
    await setResourcePinned('d1', false);
    expect(get(resources)[0].access).toEqual({ projectWide: true, orgIds: [], userIds: [] });
    expect(get(resources)[0].pinned).toBe(false);
  });

  it('pins a mock (non-document) kind locally without calling the API', async () => {
    resources.set([doc({ id: 'm1', kind: 'slides' })]);
    await setResourcePinned('m1', true);
    expect(apiMock).not.toHaveBeenCalled();
    expect(get(resources)[0].pinned).toBe(true);
  });

  it('creates a document from a template (POST /documents {fromTemplateId}) and inserts it', async () => {
    resources.set([]);
    apiMock.mockResolvedValue({ id: 'nd', name: 'From Template', updatedAt: '2026-07-26', creatorId: 'u1' });
    const r = await createResourceFromTemplate('tpl1');
    expect(apiMock).toHaveBeenCalledWith('/documents', {
      method: 'POST',
      body: JSON.stringify({ fromTemplateId: 'tpl1' })
    });
    expect(r).toMatchObject({ id: 'nd', name: 'From Template', kind: 'document', pinned: false, creatorId: 'u1' });
    expect(r.access).toEqual({ projectWide: true, orgIds: [], userIds: [] });
    expect(get(resources)[0].id).toBe('nd');
  });
});
