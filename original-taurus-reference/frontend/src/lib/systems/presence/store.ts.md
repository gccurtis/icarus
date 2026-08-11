# `presence/store.ts`

The project-presence value the Members lens reads.

## A `derived` store, because there is nothing to poll

```ts
export const projectPresence = derived([session, roster], ([$session, $roster]): ProjectPresence => {
  const projectId = $roster.projectId;
  if (!projectId) return { projectId: '', present: [], mocked: false };

  const me = $session.user;
  const present: PresentUser[] = me ? [{ userId: me.id, name: me.name, mock: false }] : [];
  const others = mockPresentMembers(projectId, $roster.members, me?.id ?? '');

  return { projectId, present: [...present, ...others], mocked: others.length > 0 };
});
```

Every other presence surface in this app polls (`startPresencePolling`, 30s, matching Omega's TTL).
This one cannot: there is no project-keyed endpoint to call
([backend request](../../../../docs/backend-requests/project-level-presence.md)). So presence is
*composed* — you from the session, everyone else from the mock over the cached roster — and the store
has no lifecycle to manage, no timer to leak, and nothing to stop on a project switch.

**You come first in the list and you are real** (`mock: false`). The order is deliberate: the lens
renders the group in array order, and the person reading it should see themselves at the top.

Project isolation comes free from `roster`, which names the project its members belong to. When the
roster switches, so does this — there is no second source of project identity to disagree with.

## What changes when Omega answers

This file, and nothing else. `projectPresence` becomes a polled `writable` fed by
`GET /projects/:id/presence`, `mock` goes false, and `mocked` goes false with it — which removes the
badge and its sentence from `MembersPanel` without touching the lens. That is the reason the mock was
built behind this shape rather than inside the component.

## Helpers

```ts
export function isPresent(presence: ProjectPresence, userId: string): boolean
export function currentPresence(): ProjectPresence
```

`isPresent` is what the roster rows use to split into `On now` / `Has access` and to draw the dot;
keeping it here means the lens never reaches into `present` and re-derives set membership itself.
`currentPresence` is the non-reactive read for callers outside a component.
