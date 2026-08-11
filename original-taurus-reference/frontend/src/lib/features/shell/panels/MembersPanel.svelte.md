# MembersPanel.svelte

The project-context rail's **Members** lens: who can reach this project, and who is on it. New
2026-07-29, taking the rail slot the `Personas` panel used to hold (agent authoring lives at
`/library/agents` now, and the `personas` store it read is still used by the dock's picker).

## Two groups, in the order the user specified

`On now`, then `Has access` — and within each, **owner, then editors, then viewers, alphabetical
inside a role**. That ordering is `byAccess` in `systems/projects/roster.ts`, pure and unit-tested,
because it is the one detail the user named exactly and a component test would only assert it
indirectly.

```svelte
const onNow = $derived(members.filter((m) => presence && isPresent(presence, m.id)));
const away = $derived(members.filter((m) => !(presence && isPresent(presence, m.id))));
```

Both groups come from the same sorted roster, so the sort survives the split — and `presence` is
`null` unless its `projectId` matches the project being rendered, which means a stale presence value
can never mark the wrong person.

## Membership is real; presence is mocked and says so

```svelte
{#if presence?.mocked}<MockBadge />{/if}
…
<p class="mb-3 text-caption text-muted">
  Everyone but you is placeholder presence: Omega tracks presence per document, not per project.
</p>
```

The roster is real (`GET /projects/:id/members`, through the shared `roster` store). Presence is not:
Omega keys presence by document, so a member sitting on the project overview is present to nobody —
including themselves. `systems/presence` composes **you** (real, from the session) with a
deterministic mock over the roster, and this lens badges the group whenever anything in it is
invented. In a single-member project nothing is invented, so no badge appears.

The one sentence of explanation is deliberate: a `Mock` badge alone tells the user their colleagues
might be fake without telling them why, and "why" here is a specific, filed gap
([`project-level-presence.md`](../../../../../docs/backend-requests/project-level-presence.md)).

## The row snippet is declared at the top level

```svelte
{#snippet row(m: Member, present: boolean)}
```

Not inside `<PanelResults>`: a snippet declared as a component's child becomes a **prop** of that
component, which `svelte-check` rejects (`'row' does not exist in type '$$ComponentProps'`). One
snippet, both groups, so a present and an absent member can only differ by the dot.

`&nbsp;` before `(you)` because Svelte trims the leading space inside the span — without it the row
read `Dev(you)`.

## Access is more than the roster

```svelte
{#if project?.visibility === 'link'}
  <p class="text-caption text-attention">Link sharing is on — anyone with the link can join.</p>
{/if}
```

A lens titled "who can reach this project" that listed only named members would be wrong while a
share link is live. The line appears only in that state, in the attention tone, and the roster count
above it is left honest ("N people have access") rather than being fudged upward by an unknown number
of link holders.

## Manage access mounts the real thing

```svelte
<ProjectSharing projectId={project?.id ?? null} />
```

The same component the top-bar Share dialog and Project settings render — the rail shows and routes,
it does not write. `Done` calls `loadRoster(id, true)`, forcing a refetch: that dialog *does* write
membership, and a cached roster still serving the pre-edit list is exactly the staleness a cache is
supposed to be careful about.
