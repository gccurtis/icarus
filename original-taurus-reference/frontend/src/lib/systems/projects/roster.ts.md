# src/lib/systems/projects/roster.ts — breakdown

Companion to [roster.ts](roster.ts). The active project's member list, cached for the
**read-only** surfaces: the context rail's Properties lens (which needs the owner's name) and its
Members lens (which needs everyone, ordered by access level).

## Why this exists next to `ProjectSharing`

`ProjectSharing` keeps its own copy of the roster on purpose — it *writes* (invite, role change,
remove) and wants its list to show exactly what it just did, including optimistic repair when a
call fails. The rail's lenses only read, and they mount one at a time as the user flips sections, so
re-issuing `GET /projects/:id/members` on every flip would be waste. Two consumers, two different
needs; this store serves the read side and does not try to serve the write side.

## The state shape

```ts
export type RosterState = {
  projectId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  members: Member[];
  error: string;
};
```

The state **names the project it belongs to**. That is what makes strict project isolation (design
law) mechanical here rather than a convention: a load for a different project replaces the whole
record instead of merging into it, and every guard is a `projectId` comparison rather than a
timestamp or a generation counter.

## Ordering — the one rule the user specified exactly

```ts
const ROLE_RANK: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

export function byAccess(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name)
  );
}
```

Owner first, then editors, then viewers, alphabetical within a role. It is pure and exported so
`roster.test.ts` can assert the order directly instead of a component test inferring it from
rendered DOM. `ownerOf` is the same idea for the single fact Properties needs.

Both copy before sorting — `[...members]` — because the store's array is shared with every other
reader, and an in-place sort would reorder their view as a side effect.

## Loading, and the two guards

```ts
export async function loadRoster(projectId: string, force = false): Promise<void> {
  const current = get(roster);
  const sameProject = current.projectId === projectId;
  if (sameProject && !force && (current.status === 'ready' || current.status === 'loading')) return;
  …
  const members = await fetchMembers(projectId);
  if (get(roster).projectId !== projectId) return;
```

Two things are being prevented. The **cache guard** (first) makes the panels' `$effect` idempotent:
they call `loadRoster` on every relevant store change, and only the first one for a project reaches
the network. The **late-response guard** (after the await) drops a reply for a project the user has
already left — the same shape every project-scoped fetch in this repo uses, and the reason
`roster.test.ts` holds one request open while switching projects.

`force` exists for the caller that knows the roster changed (a membership edit), so "cached" never
means "stale forever".

## Reset

```ts
export function resetRoster(): void {
  roster.set(fresh());
}
```

Used when a project is left, and by tests between cases. The store deliberately does *not*
subscribe to `workspace` to reset itself: it is keyed by `projectId` already, so a project switch is
handled by the replace-on-load path without a second mechanism that could disagree with it.
