import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { writable, get } from 'svelte/store';

vi.mock('$data/api', () => ({
  api: vi.fn()
}));

vi.mock('$data/session', () => ({
  session: writable({ user: { id: 'u-me', name: 'Dev', email: 'dev@taurus.local' }, ready: true })
}));

import { api } from '$data/api';
import { session } from '$data/session';
import {
  documentBarCollaboration,
  currentDocumentId,
  lastEditorInfo,
  startPresencePolling,
  stopPresencePolling
} from './collaboration';

describe('documentBarCollaboration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    session.set({ user: { id: 'u-me', name: 'Dev', email: 'dev@taurus.local' }, ready: true });
    currentDocumentId.set('');
    lastEditorInfo.set(null);
    stopPresencePolling();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('always includes the current user', () => {
    const collab = get(documentBarCollaboration);
    expect(collab.openUsers).toHaveLength(1);
    expect(collab.openUsers[0].name).toBe('Dev');
    expect(collab.openUsers[0].access).toBe('You');
    expect(collab.openUsers[0].current).toBe(true);
    expect(collab.openUsers[0].mock).toBe(false);
    expect(collab.lastEditor).toBe(collab.openUsers[0]);
  });

  it('lastEditor reflects the newest history author, not the current user', () => {
    lastEditorInfo.set({ id: 'u-2', name: 'Maya' });
    const collab = get(documentBarCollaboration);
    expect(collab.lastEditor.name).toBe('Maya');
    expect(collab.lastEditor.current).toBe(false);
    lastEditorInfo.set(null);
  });

  it('includes other users from session data', () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({
      sessions: [
        { userId: 'u-2', userName: 'Maya', currentDocumentId: 'doc-1', startedAt: '', lastActivityAt: '' },
        { userId: 'u-3', userName: 'Owen', currentDocumentId: 'doc-1', startedAt: '', lastActivityAt: '' }
      ]
    });

    currentDocumentId.set('doc-1');
    startPresencePolling('proj-1');

    return vi.advanceTimersByTimeAsync(0).then(() => {
      const collab = get(documentBarCollaboration);
      // Current user + 2 others
      expect(collab.openUsers).toHaveLength(3);
      const names = collab.openUsers.map((u) => u.name);
      expect(names).toContain('Dev');
      expect(names).toContain('Maya');
      expect(names).toContain('Owen');
    });
  });

  it('filters out the current user from session data (deduplication)', () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({
      sessions: [
        { userId: 'u-me', userName: 'Dev', currentDocumentId: 'doc-1', startedAt: '', lastActivityAt: '' },
        { userId: 'u-2', userName: 'Maya', currentDocumentId: 'doc-1', startedAt: '', lastActivityAt: '' }
      ]
    });

    currentDocumentId.set('doc-1');
    startPresencePolling('proj-1');

    return vi.advanceTimersByTimeAsync(0).then(() => {
      const collab = get(documentBarCollaboration);
      // Current user not duplicated
      expect(collab.openUsers).toHaveLength(2);
      expect(collab.openUsers.filter((u) => u.id === 'u-me')).toHaveLength(1);
    });
  });

  it('only shows users viewing the current document', () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({
      sessions: [
        { userId: 'u-2', userName: 'Maya', currentDocumentId: 'doc-1', startedAt: '', lastActivityAt: '' },
        { userId: 'u-3', userName: 'Owen', currentDocumentId: 'doc-2', startedAt: '', lastActivityAt: '' }
      ]
    });

    currentDocumentId.set('doc-1');
    startPresencePolling('proj-1');

    return vi.advanceTimersByTimeAsync(0).then(() => {
      const collab = get(documentBarCollaboration);
      // Current user + Maya (on doc-1) only
      expect(collab.openUsers).toHaveLength(2);
      const names = collab.openUsers.map((u) => u.name);
      expect(names).toContain('Maya');
      expect(names).not.toContain('Owen');
    });
  });

  it('shows all project users when no current document is set', () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValueOnce({
      sessions: [
        { userId: 'u-2', userName: 'Maya', currentDocumentId: 'doc-1', startedAt: '', lastActivityAt: '' },
        { userId: 'u-3', userName: 'Owen', currentDocumentId: 'doc-2', startedAt: '', lastActivityAt: '' }
      ]
    });

    currentDocumentId.set('');
    startPresencePolling('proj-1');

    return vi.advanceTimersByTimeAsync(0).then(() => {
      const collab = get(documentBarCollaboration);
      // All 3 users shown
      expect(collab.openUsers).toHaveLength(3);
    });
  });

  it('handles API failure gracefully', () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockRejectedValueOnce(new Error('network error'));

    currentDocumentId.set('doc-1');
    startPresencePolling('proj-1');

    return vi.advanceTimersByTimeAsync(0).then(() => {
      const collab = get(documentBarCollaboration);
      // Only current user shown on error
      expect(collab.openUsers).toHaveLength(1);
    });
  });

  it('stops polling when stopPresencePolling is called', () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    mockApi.mockResolvedValue({ sessions: [] });

    startPresencePolling('proj-1');
    stopPresencePolling();

    // Advance past multiple poll intervals
    vi.advanceTimersByTime(60000);

    // Poll was called only once (immediate), not on interval
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('uses a fallback when no session user exists', () => {
    session.set({ user: null, ready: true });
    const collab = get(documentBarCollaboration);
    expect(collab.openUsers).toHaveLength(1);
    expect(collab.openUsers[0].name).toBe('Current editor');
    expect(collab.openUsers[0].mock).toBe(true);
  });
});
