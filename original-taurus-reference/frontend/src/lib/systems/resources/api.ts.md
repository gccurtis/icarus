# src/lib/systems/resources/api.ts — breakdown

Companion to [api.ts](api.ts). The resources data client: it loads the project's resource catalog (paged `GET /resources`) into the store, creates / renames / removes resources, AI-generates a document (`POST /resources/generate`), creates one from a template (`POST /documents`), and edits the catalog attributes — **pin** (`PATCH …/attributes`) and **access** (`PATCH …/access`, owner-only). Non-document kinds are front-end mock editors, so their mutations stay local; every real response maps through `toResource`, which carries `pinned` / `access` / `creatorId`.

## Imports

### Pull in the API client, project-retry wrapper, resource types, and stores

```ts
import { get } from 'svelte/store';
import { api } from '$data/api';
import { withProject } from '$data/project-retry';
import type { AccessScope, Resource, ResourceKind } from './types';
import { projectWideAccess, toKind } from './types';
import { resources, availableKinds } from './store';

```

`api` is the base fetch client (requests go to `/api/*`); `withProject` retries a call under a specific project context (used when loading the catalog). The type-only import brings the domain shapes, the value import brings the default-scope factory and the kind-narrowing helper, and the store import gives the mutations their reactive targets. The trailing blank line separates imports from the wire types.

## API wire types

### The raw Omega shapes for a resource, its access, and a page

```ts
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

```

These describe Omega's wire format, distinct from the UI types. Fields the backend may omit are optional (`pinned`, `access`, `creatorId`) so the mappers below can fill defaults; `kind` is a plain `string` here because the backend is not constrained to our union — `toKind` narrows it later. `ApiPage` is one page of the cursor-paginated catalog: the resources, the creatable kinds, and the next cursor (`null` at the end). The trailing blank line separates the wire types from the mappers.

## Mapping API shapes to domain types

### Normalize an access scope and a resource from wire to UI shape

```ts
function toAccess(a: ApiAccessScope | undefined): AccessScope {
  return { projectWide: a?.projectWide ?? true, orgIds: a?.orgIds ?? [], userIds: a?.userIds ?? [] };
}

function toResource(r: ApiResource): Resource {
  return {
    id: r.id,
    name: r.name,
    kind: toKind(r.kind),
    updatedAt: Date.parse(r.updatedAt),
    pinned: r.pinned ?? false,
    access: toAccess(r.access),
    creatorId: r.creatorId || undefined
  };
}

```

`toAccess` turns a possibly-absent wire scope into a total `AccessScope`, defaulting to project-wide with empty id lists (Omega's default when it omits access). `toResource` is the single boundary that produces a UI `Resource`: it narrows `kind` through `toKind`, parses the ISO `updatedAt` and `createdAt` into numeric epochs for direct sorting/formatting, defaults `pinned` to `false`, normalizes access, and coerces an empty-string `creatorId` to `undefined` so ownership checks treat "no creator" uniformly. The trailing blank line separates the mappers from `canCreate`.

## Can-create check

### Report whether a kind is creatable in the current project

```ts
export function canCreate(kind: ResourceKind): boolean {
  return get(availableKinds).includes(kind);
}

```

`canCreate` reads the `availableKinds` store synchronously and reports whether the given kind is offered, letting the create UI enable or disable a kind without subscribing. The trailing blank line separates it from `loadCatalog`.

## Loading the catalog

### Page through every resource and collect the creatable kinds

```ts
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

```

`loadCatalog` walks the cursor-paginated `GET /resources` endpoint 100 at a time, accumulating mapped resources across pages and taking the creatable `kinds` from each response (the last page's value stands, since Omega repeats it). The `do…while` runs at least once and continues until `nextCursor` is `null`. It is private — `enterProjectResources` is the public entry that runs it under a project context and writes the stores. The trailing blank line separates it from that entry point.

## Entering a project's resources

### Load the catalog under a project context and seed the stores

```ts
export async function enterProjectResources(projectId: string): Promise<void> {
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
  }
}

```

`enterProjectResources` is called when a project workspace opens. It loads the catalog through `withProject` (so the request carries the right project and can be retried), then sets both stores. It augments the backend's creatable kinds with `slides` — a front-end mock editor Omega doesn't know about — so the create UI still offers it. On any failure it degrades gracefully: an empty catalog with `slides` still available, so the UI never gets stuck on a load error. The trailing blank line separates it from `addResource`.

It also brackets the load with `resourcesLoaded` — cleared on entry, set in a `finally`. That flag matters more than a loading spinner would suggest: because Omega filters this catalog by access scope, the resulting list is what the activity feed uses to decide which event targets a user is entitled to see. Clearing it on entry keeps a stale catalog from the previous project from answering that question for the new one, and setting it even on failure keeps the feed from stranding on its loading state. See [store.ts.md](store.ts.md).

## Adding a resource

### Create a real document via Omega, or a local mock for other kinds

```ts
export async function addResource(projectId: string, name: string, kind: ResourceKind): Promise<Resource> {
  // Slides is a front-end mock editor — create a local resource without calling Omega.
  if (kind !== 'document') {
    const created: Resource = {
      id: `mock_${kind}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || 'Untitled',
      kind,
      updatedAt: Date.now(),
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

```

`addResource` branches on kind. For non-document (mock) kinds it fabricates a resource locally — a `mock_`-prefixed random id, a trimmed-or-"Untitled" name, project-wide access — and never touches Omega. For documents it POSTs to `/resources`, maps the response, and returns it. Both paths prepend the new resource to the store (filtering any id collision first) so it appears at the top immediately. Names default to "Untitled" when blank. The trailing blank line separates it from `generateResource`.

## Generating a document

### AI-generate a document and return its background task id

```ts
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

```

`generateResource` POSTs a prompt to `/resources/generate`. Omega returns the resource immediately (so it can be shown at once) plus a `taskId` for the background generation job the caller polls to know when content has landed. As with `addResource`, the new resource is prepended to the store, and the `{ resource, taskId }` pair is returned so the UI can both display the row and track the task. The trailing blank line separates it from `createResourceFromTemplate`.

## Creating from a template

### Instantiate a document template and reflect it in the catalog

```ts
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
    pinned: false,
    access: projectWideAccess(),
    creatorId: doc.creatorId || undefined
  };
  resources.update((list) => [created, ...list.filter((x) => x.id !== created.id)]);
  return created;
}

```

`createResourceFromTemplate` creates a document from a template. There is no dedicated route — create-from-template is a `fromTemplateId` field on the normal document create — so it POSTs to `/documents` and receives a document, not a wire `ApiResource`. It maps that document into a `Resource` by hand (defaulting a blank name to "Untitled", fixing `kind` to `document`, parsing `updatedAt` or falling back to now, defaulting pin/access, and coercing an empty `creatorId` to `undefined`), then prepends it to the store like the other creators. The trailing blank line separates it from `removeResource`.

## Removing a resource

### Delete a real document via Omega, or drop a mock locally

```ts
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

```

`removeResource` looks up the resource in the store (returning early if it is already gone). Mock kinds are just filtered out locally. Documents are DELETEd from Omega first, then removed from the store, so the row only disappears once the backend has confirmed the delete. The trailing blank line separates it from `renameResource`.

## Renaming a resource

### Rename a real document via PATCH, or edit a mock locally

```ts
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

```

`renameResource` mirrors the remove pattern. Mock kinds update the name and bump `updatedAt` locally. Documents PATCH the new name to Omega and replace the store entry with the mapped response, so the row reflects the backend's authoritative record (including any server-set `updatedAt`). The trailing blank line separates it from `setResourcePinned`.

## Pinning a resource

### Toggle the per-project pin attribute

```ts
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

```

`setResourcePinned` PATCHes the `attributes` sub-resource with the new pin flag. Pinning is a client-side ordering concern — Omega stores the flag but leaves sorting to the table — so this only records the attribute. Mock kinds flip it locally; documents persist it and adopt the mapped response. The trailing blank line separates it from `setResourceAccess`.

## Setting access

### Update the visibility scope (owner-only on the backend)

```ts
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

```

`setResourceAccess` PATCHes the `access` sub-resource, wrapping the scope under an `access` key as Omega expects. The backend enforces owner-only editing (a non-owner receives 403, which the caller surfaces as a toast), so the client does not pre-check ownership here. Mock kinds update the scope locally; documents persist and re-map. The trailing blank line separates it from the final re-export.

## Time-formatting re-export

### Re-export the relative-time helper for row rendering

```ts
export { relativeTime } from '$data/time';
```

`relativeTime` is re-exported so the resource table can format `updatedAt` by importing from `$data/resources` alongside the types and functions it already uses, rather than reaching into `$data/time` separately. It is a pure pass-through — the resources system owns none of its logic, only its convenient placement on this surface.
