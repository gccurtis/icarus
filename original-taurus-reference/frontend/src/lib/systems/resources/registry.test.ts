import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writable } from 'svelte/store';
import {
  registerResourceKind,
  acquire,
  active,
  getRuntime,
  type ResourceRuntime
} from './registry';

vi.mock('$data/workspace', () => ({
  workspace: writable(null)
}));

import { workspace } from '$data/workspace';

// A test runtime that tracks disposal
class TestRuntime implements ResourceRuntime {
  readonly projectId: string;
  readonly resourceId: string;
  readonly title: string;
  disposed = false;

  constructor(projectId: string, resourceId: string, title: string, _key: string) {
    this.projectId = projectId;
    this.resourceId = resourceId;
    this.title = title;
  }

  dispose(): void {
    this.disposed = true;
  }
}

describe('ResourceRegistry', () => {
  beforeEach(() => {
    // Reset the workspace store to clear the registry subscriber state
    workspace.set(null);
    vi.clearAllMocks();
  });

  describe('register and acquire', () => {
    it('throws if no factory is registered for the kind', () => {
      // Set a workspace first so the subscriber is in a known state
      workspace.set({
        projectId: 'p0',
        tabs: [{ id: 'overview', title: 'Overview', closeable: false }],
        activeTabId: 'overview',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });
      expect(() => acquire('slides', 'p1', 'r1', 'Test')).toThrow(
        'No runtime factory registered for resource kind: slides'
      );
    });

    it('returns a runtime from a registered factory', () => {
      workspace.set({ projectId: 'p0', tabs: [{ id: 'overview', title: 'Overview', closeable: false }], activeTabId: 'overview', context: { width: 220, collapsed: false, section: 'properties' }, inspector: { width: 220, collapsed: false, section: 'details' } });
      registerResourceKind('document', (projectId, resourceId, title, key) =>
        new TestRuntime(projectId, resourceId, title, key)
      );
      const runtime = acquire('document', 'proj-1', 'res-1', 'My Doc');
      expect(runtime).toBeDefined();
      const doc = runtime as TestRuntime;
      expect(doc.projectId).toBe('proj-1');
      expect(doc.resourceId).toBe('res-1');
      expect(doc.title).toBe('My Doc');
    });

    it('returns the same runtime for the same key (singleton)', () => {
      workspace.set({ projectId: 'p0', tabs: [{ id: 'overview', title: 'Overview', closeable: false }], activeTabId: 'overview', context: { width: 220, collapsed: false, section: 'properties' }, inspector: { width: 220, collapsed: false, section: 'details' } });
      registerResourceKind('document', (p, r, t, k) =>
        new TestRuntime(p, r, t, k)
      );
      const rt1 = acquire('document', 'proj-2', 'res-2', 'Doc');
      const rt2 = acquire('document', 'proj-2', 'res-2', 'Doc Renamed');
      expect(rt1).toBe(rt2);
    });

    it('returns different runtimes for different resource ids', () => {
      workspace.set({ projectId: 'p0', tabs: [{ id: 'overview', title: 'Overview', closeable: false }], activeTabId: 'overview', context: { width: 220, collapsed: false, section: 'properties' }, inspector: { width: 220, collapsed: false, section: 'details' } });
      registerResourceKind('document', (p, r, t, k) =>
        new TestRuntime(p, r, t, k)
      );
      const rt1 = acquire('document', 'proj-3', 'res-a', 'Doc A');
      const rt2 = acquire('document', 'proj-3', 'res-b', 'Doc B');
      expect(rt1).not.toBe(rt2);
    });
  });

  describe('getRuntime', () => {
    it('returns undefined for unknown key', () => {
      workspace.set({ projectId: 'p0', tabs: [{ id: 'overview', title: 'Overview', closeable: false }], activeTabId: 'overview', context: { width: 220, collapsed: false, section: 'properties' }, inspector: { width: 220, collapsed: false, section: 'details' } });
      expect(getRuntime('proj-x:res-x')).toBeUndefined();
    });

    it('returns the runtime for a known key', () => {
      workspace.set({ projectId: 'proj-4', tabs: [{ id: 'overview', title: 'Overview', closeable: false }], activeTabId: 'overview', context: { width: 220, collapsed: false, section: 'properties' }, inspector: { width: 220, collapsed: false, section: 'details' } });
      registerResourceKind('document', (p, r, t, k) =>
        new TestRuntime(p, r, t, k)
      );
      acquire('document', 'proj-4', 'res-4', 'Doc');
      const found = getRuntime('proj-4:res-4');
      expect(found).toBeDefined();
    });
  });

  describe('active', () => {
    it('returns null when no workspace is set', () => {
      expect(active()).toBeNull();
    });

    it('returns null when no tab is active', () => {
      workspace.set({
        projectId: 'proj-5',
        tabs: [{ id: 'overview', title: 'Overview', closeable: false }],
        activeTabId: 'overview',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });
      expect(active()).toBeNull();
    });

    it('returns the runtime for the active resource tab', () => {
      registerResourceKind('document', (p, r, t, k) =>
        new TestRuntime(p, r, t, k)
      );

      // Set workspace first, so the subscriber knows the project
      workspace.set({
        projectId: 'proj-6',
        tabs: [
          { id: 'overview', title: 'Overview', closeable: false }
        ],
        activeTabId: 'overview',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });

      // Then acquire the runtime
      const runtime = acquire('document', 'proj-6', 'res-6', 'Active Doc');

      // Now open a resource tab
      workspace.set({
        projectId: 'proj-6',
        tabs: [
          { id: 'overview', title: 'Overview', closeable: false },
          { id: 'tab-1', title: 'Active Doc', closeable: true, kind: 'resource', resourceId: 'res-6', resourceKind: 'document' }
        ],
        activeTabId: 'tab-1',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });

      expect(active()).toBe(runtime);
    });
  });

  describe('disposal on tab close', () => {
    it('disposes a runtime when its tab is removed', () => {
      registerResourceKind('document', (p, r, t, k) =>
        new TestRuntime(p, r, t, k)
      );

      // Set workspace first
      workspace.set({
        projectId: 'proj-7',
        tabs: [
          { id: 'overview', title: 'Overview', closeable: false },
          { id: 'tab-tmp', title: 'Temp Doc', closeable: true, kind: 'resource', resourceId: 'res-7', resourceKind: 'document' }
        ],
        activeTabId: 'tab-tmp',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });

      const runtime = acquire('document', 'proj-7', 'res-7', 'Temp Doc') as TestRuntime;
      expect(runtime.disposed).toBe(false);

      // Close the tab
      workspace.set({
        projectId: 'proj-7',
        tabs: [
          { id: 'overview', title: 'Overview', closeable: false }
        ],
        activeTabId: 'overview',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });

      expect(runtime.disposed).toBe(true);
    });
  });

  describe('project isolation', () => {
    it('disposes all runtimes on project change', () => {
      registerResourceKind('document', (p, r, t, k) =>
        new TestRuntime(p, r, t, k)
      );

      // Set workspace to project A first
      workspace.set({
        projectId: 'proj-a',
        tabs: [
          { id: 'overview', title: 'Overview', closeable: false },
          { id: 't1', title: 'Doc 1', closeable: true, kind: 'resource', resourceId: 'res-1', resourceKind: 'document' },
          { id: 't2', title: 'Doc 2', closeable: true, kind: 'resource', resourceId: 'res-2', resourceKind: 'document' }
        ],
        activeTabId: 't1',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });

      const rt1 = acquire('document', 'proj-a', 'res-1', 'Doc 1') as TestRuntime;
      const rt2 = acquire('document', 'proj-a', 'res-2', 'Doc 2') as TestRuntime;

      // Switch project
      workspace.set({
        projectId: 'proj-b',
        tabs: [
          { id: 'overview', title: 'Overview', closeable: false }
        ],
        activeTabId: 'overview',
        context: { width: 220, collapsed: false, section: 'properties' },
        inspector: { width: 220, collapsed: false, section: 'details' }
      });

      expect(rt1.disposed).toBe(true);
      expect(rt2.disposed).toBe(true);
    });
  });
});
