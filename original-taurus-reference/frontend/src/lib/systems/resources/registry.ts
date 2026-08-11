import { get } from 'svelte/store';
import { workspace } from '$data/workspace';
import type { ResourceKind } from './types';

// Resource Registry — per-kind runtime factories.
// Each resource kind registers a factory at app init. The registry dispatches
// acquire(kind, projectId, resourceId) by looking up the factory. A workspace
// subscriber disposes runtimes when their tab closes or the project changes.

interface Disposable {
  dispose(): void;
}

export type ResourceRuntime = Disposable;

type RuntimeFactory = (
  projectId: string,
  resourceId: string,
  title: string,
  key: string
) => ResourceRuntime;

const factories = new Map<string, RuntimeFactory>();
const runtimes = new Map<string, ResourceRuntime>();

function runtimeKey(projectId: string, resourceId: string): string {
  return `${projectId}:${resourceId}`;
}

export function registerResourceKind(
  kind: ResourceKind,
  factory: RuntimeFactory
): void {
  factories.set(kind, factory);
}

export function acquire(
  kind: ResourceKind,
  projectId: string,
  resourceId: string,
  title: string
): ResourceRuntime {
  const key = runtimeKey(projectId, resourceId);
  let rt = runtimes.get(key);
  if (!rt) {
    const factory = factories.get(kind);
    if (!factory) throw new Error(`No runtime factory registered for resource kind: ${kind}`);
    rt = factory(projectId, resourceId, title, key);
    runtimes.set(key, rt);
  }
  return rt;
}

/** The runtime for the active resource tab, or null if no resource is active. */
export function active(): ResourceRuntime | null {
  const ws = get(workspace);
  if (!ws) return null;
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId);
  if (!tab || tab.kind !== 'resource' || !tab.resourceId) return null;
  const key = runtimeKey(ws.projectId, tab.resourceId);
  return runtimes.get(key) ?? null;
}

export function getRuntime(key: string): ResourceRuntime | undefined {
  return runtimes.get(key);
}

// --- lifecycle: workspace subscriber for disposal and isolation ----------------

let watchedProject: string | null = null;
workspace.subscribe((ws) => {
  if (!ws) {
    for (const rt of runtimes.values()) rt.dispose();
    runtimes.clear();
    watchedProject = null;
    return;
  }
  if (watchedProject !== ws.projectId) {
    for (const rt of runtimes.values()) rt.dispose();
    runtimes.clear();
    watchedProject = ws.projectId;
    return;
  }
  const open = new Set(
    ws.tabs
      .filter((t) => t.kind === 'resource' && t.resourceId)
      .map((t) => runtimeKey(ws.projectId, t.resourceId!))
  );
  for (const [key, rt] of [...runtimes]) {
    if (!open.has(key)) {
      rt.dispose();
      runtimes.delete(key);
    }
  }
});
