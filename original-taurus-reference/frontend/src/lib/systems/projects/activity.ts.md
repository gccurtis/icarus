# src/lib/systems/projects/activity.ts — breakdown

Companion to [activity.ts](activity.ts). The activity-feed client for the projects system:
it loads a cursor-paginated page of activity events (with project-scoped retry), looks up a
public user and a resource's metadata, and re-exports the shared timestamp formatter. Each
loader maps the raw Omega wire shape into the UI types from `./types`.

## Imports

### Import the API client, project-retry wrapper, resource-kind helpers, and activity types

```ts
import { api } from '$data/api';
import { withProject } from '$data/project-retry';
import { type ResourceKind, toKind } from '$data/resources';
import type { ActivityAction, ActivityActor, ActivityTarget, ActivityEvent, ActivityPage, PublicUser, ResourceMetadata } from './types';

```

`api` is the base fetch client; `withProject` re-runs a request under the correct project
context (retrying once after the session's active project is switched). `toKind` narrows a raw
kind string to the `ResourceKind` union. The remaining `import type` pulls in the UI shapes
this module produces. The blank line separates imports from the wire types.

## Wire types

### The raw Omega API shapes for activity events, pages, and resources

```ts
type ApiActivityEvent = {
  id: string;
  actor: { id: string; name: string };
  action: ActivityAction;
  target: { id: string; name: string; kind: string };
  occurredAt: string;
};
type ApiActivityPage = { events: ApiActivityEvent[]; nextCursor: string | null };
type ApiResource = { id: string; name: string; kind: string; createdAt: string; updatedAt: string };

```

These private types mirror exactly what Omega returns: `kind` is still a loose `string` and
timestamps are ISO `string`s, unlike the UI types where `kind` is narrowed and timestamps are
numbers. Keeping the wire shapes separate makes the mapping step below explicit. The blank
line separates the types from the mappers.

## Mappers

### Convert an API activity event and API resource into their UI shapes

```ts
function toActivityEvent(event: ApiActivityEvent): ActivityEvent {
  return {
    id: event.id, actor: event.actor, action: event.action,
    target: { ...event.target, kind: toKind(event.target.kind) },
    occurredAt: Date.parse(event.occurredAt)
  };
}

function toResource(resource: ApiResource): ResourceMetadata {
  return {
    id: resource.id, name: resource.name, kind: toKind(resource.kind),
    createdAt: Date.parse(resource.createdAt), updatedAt: Date.parse(resource.updatedAt)
  };
}

```

Both mappers do the same two normalizations: narrow the raw `kind` string via `toKind`, and
parse ISO timestamp strings into numeric epoch millis via `Date.parse`. `toActivityEvent`
passes `actor` through untouched and spreads the target before overriding its `kind`;
`toResource` flattens a resource's identity and its two timestamps. The blank line separates
the mappers from the exported loaders.

## Activity feed

### Load a page of activity events with project-scoped retry

```ts
export async function loadActivityPage(
  projectId: string,
  cursor: string | null = null,
  limit = 8,
  targetId?: string
): Promise<ActivityPage> {
  const fetchPage = (): Promise<ApiActivityPage> => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    if (targetId) query.set('targetID', targetId);
    return api<ApiActivityPage>(`/activity?${query}`);
  };
  const page = await withProject(projectId, fetchPage);
  return { events: page.events.map(toActivityEvent), nextCursor: page.nextCursor };
}

```

`loadActivityPage` builds a `/activity` request with a `limit` and optional `cursor`, then
runs it through `withProject` so the call is retried under `projectId` if the server's active
project differs. The raw page's events are mapped to the UI shape and `nextCursor` is passed
through for the caller to page forward. The blank line separates it from the lookups.

`targetId` narrows the feed to one resource's events. Omega's handler has always accepted it
(`PageRequest.TargetID`); Alpha simply never sent it until the Overview inspector needed a
per-resource timeline. It is worth knowing that this filter works for **every** resource kind,
which is what makes it — rather than document history — the timeline source the lenses build on:
change-level history with real before/after and undo exists only for documents.

Two cautions carried by this endpoint. It performs **no access check**, so a caller can pass a
restricted resource's id and receive its history; that is filed in
[`resource-access-enforcement.md`](../../../../docs/backend-requests/resource-access-enforcement.md)
and worked around in `lens-helpers.ts`. And Omega records nothing for a no-op change — renaming a
resource to the name it already has produces no event, which cost an hour of confusion in an e2e
fixture before it was understood.

## User and resource lookups

### Fetch a public user profile and a resource's metadata by id

```ts
export function getPublicUser(userId: string): Promise<PublicUser> {
  return api<PublicUser>(`/users/${encodeURIComponent(userId)}`);
}

export async function getResourceMetadata(kind: ResourceKind, resourceId: string): Promise<ResourceMetadata> {
  const resource = await api<ApiResource>(`/resources/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}`);
  return toResource(resource);
}

```

`getPublicUser` is a thin GET on `/users/:id` whose response already matches `PublicUser`, so
it returns the promise directly (the id is URL-encoded for safety). `getResourceMetadata`
GETs `/resources/:kind/:id` and normalizes the wire resource through `toResource`. The blank
line separates the lookups from the final re-export.

## Re-export

### Re-export the activity timestamp formatter from the time module

```ts
export { activityStamp } from '$data/time';
```

`activityStamp` (the relative/absolute timestamp formatter used to label feed entries) lives
in the shared time module; re-exporting it here lets activity-feed consumers import both the
data loaders and their formatter from one place.
