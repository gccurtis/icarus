import { get } from 'svelte/store';
import { api } from '$data/api';
import { withProject } from '$data/project-retry';
import type { AccessScope, Resource, ResourceKind } from './types';
import { projectWideAccess, toKind } from './types';
import { resources, availableKinds, resourcesLoaded } from './store';

type ApiAccessScope = { projectWide?: boolean; orgIds?: string[]; userIds?: string[] };
type ApiResource = {
  id: string;
  kind: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  access?: ApiAccessScope;
  creatorId?: string;
};
type ApiPage = { resources: ApiResource[]; availableKinds: string[]; nextCursor: string | null };

function toAccess(a: ApiAccessScope | undefined): AccessScope {
  return { projectWide: a?.projectWide ?? true, orgIds: a?.orgIds ?? [], userIds: a?.userIds ?? [] };
}

function toResource(r: ApiResource): Resource {
  return {
    id: r.id,
    name: r.name,
    kind: toKind(r.kind),
    updatedAt: Date.parse(r.updatedAt),
    createdAt: Date.parse(r.createdAt),
    pinned: r.pinned ?? false,
    access: toAccess(r.access),
    creatorId: r.creatorId || undefined
  };
}

export function canCreate(kind: ResourceKind): boolean {
  return get(availableKinds).includes(kind);
}

async function loadCatalog(): Promise<{ items: Resource[]; kinds: ResourceKind[] }> {
  const items: Resource[] = [];
  let kinds: ResourceKind[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page: ApiPage = await api<ApiPage>(`/resources?${query}`);
    items.push(...page.resources.map(toResource));
    kinds = page.availableKinds.map(toKind);
    cursor = page.nextCursor;
  } while (cursor);
  return { items, kinds };
}

export async function enterProjectResources(projectId: string): Promise<void> {
  // Cleared first: a stale catalog from the project being left must not be read
  // as an access answer for the one being entered.
  resourcesLoaded.set(false);
  try {
    const catalog = await withProject(projectId, () => loadCatalog());
    resources.set(catalog.items);
    // Include slides as a mock-available kind so the create UI enables it.
    // Omega only supports 'document' today; slides is a front-end mock editor.
    const kinds = catalog.kinds.includes('slides' as ResourceKind)
      ? catalog.kinds
      : [...catalog.kinds, 'slides' as ResourceKind];
    availableKinds.set(kinds);
  } catch {
    resources.set([]);
    availableKinds.set(['slides']);
  } finally {
    // Marked loaded even on failure: an empty catalog is the honest answer we
    // have, and leaving this false would strand the activity feed on its
    // loading state forever whenever the catalog call fails.
    resourcesLoaded.set(true);
  }
}

export async function addResource(projectId: string, name: string, kind: ResourceKind): Promise<Resource> {
  // Slides is a front-end mock editor — create a local resource without calling Omega.
  if (kind !== 'document') {
    const created: Resource = {
      id: `mock_${kind}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || 'Untitled',
      kind,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      pinned: false,
      access: projectWideAccess()
    };
    resources.update((list) => [created, ...list.filter((x) => x.id !== created.id)]);
    return created;
  }
  const r = await api<ApiResource>('/resources', {
    method: 'POST',
    body: JSON.stringify({ kind, name: name.trim() || 'Untitled' })
  });
  const created = toResource(r);
  resources.update((list) => [created, ...list.filter((x) => x.id !== created.id)]);
  return created;
}

/**
 * AI-generate a document from a prompt (`POST /resources/generate`). Omega creates
 * the resource immediately and enqueues a generation task (`taskId`) that populates
 * it in the background; only documents can be generated today.
 */
export async function generateResource(
  prompt: string
): Promise<{ resource: Resource; taskId: string }> {
  const res = await api<{ resource: ApiResource; taskId: string }>('/resources/generate', {
    method: 'POST',
    body: JSON.stringify({ kind: 'document', prompt: prompt.trim() })
  });
  const created = toResource(res.resource);
  resources.update((list) => [created, ...list.filter((x) => x.id !== created.id)]);
  return { resource: created, taskId: res.taskId };
}

/**
 * Create a document from a template (`POST /documents { fromTemplateId }`) and reflect
 * it in the catalog. Create-from-template is a field on the normal document create —
 * there is no dedicated route — so the response is a document, mapped to a Resource.
 */
export async function createResourceFromTemplate(templateId: string): Promise<Resource> {
  const doc = await api<{ id: string; name: string; updatedAt?: string; creatorId?: string }>(
    '/documents',
    { method: 'POST', body: JSON.stringify({ fromTemplateId: templateId }) }
  );
  const created: Resource = {
    id: doc.id,
    name: doc.name || 'Untitled',
    kind: 'document',
    updatedAt: doc.updatedAt ? Date.parse(doc.updatedAt) : Date.now(),
    createdAt: Date.now(),
    pinned: false,
    access: projectWideAccess(),
    creatorId: doc.creatorId || undefined
  };
  resources.update((list) => [created, ...list.filter((x) => x.id !== created.id)]);
  return created;
}

export async function removeResource(projectId: string, id: string): Promise<void> {
  const r = get(resources).find((x) => x.id === id);
  if (!r) return;
  // Mock resources don't exist in Omega — just remove from local store.
  if (r.kind !== 'document') {
    resources.update((list) => list.filter((x) => x.id !== id));
    return;
  }
  await api(`/resources/${r.kind}/${id}`, { method: 'DELETE' });
  resources.update((list) => list.filter((x) => x.id !== id));
}

export async function renameResource(projectId: string, id: string, name: string): Promise<void> {
  const r = get(resources).find((x) => x.id === id);
  if (!r) return;
  // Mock resources don't exist in Omega — just update the local store.
  if (r.kind !== 'document') {
    resources.update((list) => list.map((x) => (x.id === id ? { ...x, name: name.trim(), updatedAt: Date.now() } : x)));
    return;
  }
  const updated = toResource(
    await api<ApiResource>(`/resources/${r.kind}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim() })
    })
  );
  resources.update((list) => list.map((x) => (x.id === id ? updated : x)));
}

/**
 * Pin or unpin a resource (`PATCH /resources/:kind/:id/attributes`). Pinning is
 * per-project and the client renders pinned resources first; Omega does not
 * reorder. Requires project write role. Mock kinds pin locally only.
 */
export async function setResourcePinned(id: string, pinned: boolean): Promise<void> {
  const r = get(resources).find((x) => x.id === id);
  if (!r) return;
  if (r.kind !== 'document') {
    resources.update((list) => list.map((x) => (x.id === id ? { ...x, pinned } : x)));
    return;
  }
  const updated = toResource(
    await api<ApiResource>(`/resources/${r.kind}/${id}/attributes`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned })
    })
  );
  resources.update((list) => list.map((x) => (x.id === id ? updated : x)));
}

/**
 * Set a resource's access scope (`PATCH /resources/:kind/:id/access`). Owner-only
 * on the backend (a non-owner gets 403); the body wraps the scope in `access`.
 * Mock kinds update locally only.
 */
export async function setResourceAccess(id: string, access: AccessScope): Promise<void> {
  const r = get(resources).find((x) => x.id === id);
  if (!r) return;
  if (r.kind !== 'document') {
    resources.update((list) => list.map((x) => (x.id === id ? { ...x, access } : x)));
    return;
  }
  const updated = toResource(
    await api<ApiResource>(`/resources/${r.kind}/${id}/access`, {
      method: 'PATCH',
      body: JSON.stringify({ access })
    })
  );
  resources.update((list) => list.map((x) => (x.id === id ? updated : x)));
}

export { relativeTime } from '$data/time';
