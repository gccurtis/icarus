import { api } from '$data/api';
import { withProject } from '$data/project-retry';
import { type ResourceKind, toKind } from '$data/resources';
import type { ActivityAction, ActivityActor, ActivityTarget, ActivityEvent, ActivityPage, PublicUser, ResourceMetadata } from './types';

type ApiActivityEvent = {
  id: string;
  actor: { id: string; name: string };
  action: ActivityAction;
  target: { id: string; name: string; kind: string };
  occurredAt: string;
};
type ApiActivityPage = { events: ApiActivityEvent[]; nextCursor: string | null };
type ApiResource = { id: string; name: string; kind: string; createdAt: string; updatedAt: string };

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

/**
 * One page of the project's activity feed, newest first.
 *
 * `targetId` narrows the feed to a single resource's events — Omega's `/activity`
 * has always accepted it (`PageRequest.TargetID`) and it works for every resource
 * kind, which makes it the one timeline source the inspector lenses can rely on.
 * Change-level history (real before/after, undo) exists only for documents.
 */
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

export function getPublicUser(userId: string): Promise<PublicUser> {
  return api<PublicUser>(`/users/${encodeURIComponent(userId)}`);
}

export async function getResourceMetadata(kind: ResourceKind, resourceId: string): Promise<ResourceMetadata> {
  const resource = await api<ApiResource>(`/resources/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}`);
  return toResource(resource);
}

export { activityStamp } from '$data/time';
