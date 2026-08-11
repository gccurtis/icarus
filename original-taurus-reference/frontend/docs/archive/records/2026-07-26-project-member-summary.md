# 2026-07-26 — Phase G: real project member summary on the projects list

The projects list rendered a member avatar cluster, but `GET /projects` only returned the
caller's own membership, so `toProject` set `members: [self]` — the stack could only ever show
**you**. Omega now returns a bounded member summary on every project, so the list shows the
real roster preview.

Contract (verified against Omega source): `GET /projects` → `{ projects: [projectJSON] }` where
each project carries `members: { items: [{ userId, name, avatarUrl }], total }` (items capped at
5, ordered by email; `total` exact; public fields only — no email/role in the summary). Always
present, no `opts` guard.

## Model + mapper

```ts
// systems/projects/types.ts
export type MemberSummaryItem = { userId: string; name: string; avatarUrl?: string };
export type MemberSummary = { items: MemberSummaryItem[]; total: number };
// Project gains: memberSummary: MemberSummary   (distinct from `members`, the full roster)

// systems/projects/api.ts
function toMemberSummary(m: ApiMemberSummary | undefined): MemberSummary {
  return { items: (m?.items ?? []).map((it) => ({ userId: it.userId, name: it.name, avatarUrl: it.avatarUrl || undefined })), total: m?.total ?? 0 };
}
// toProject now returns memberSummary: toMemberSummary(p.members)
```

`memberSummary` is a new field alongside `members` (the on-demand full roster used by settings),
so the list has real avatars while nothing that relies on the `Member[]` roster changes. It
defaults to `{ items: [], total: 0 }` when the payload omits it, so an older server degrades to
an empty cluster rather than an error.

## Summary → profile-card adapter

```ts
// systems/identity-directory/resolvers.ts
export function identityProfileFromMemberSummary(item: { userId; name; avatarUrl? }): IdentityProfile {
  // name + avatarUrl only; generic role/description since the summary is public-fields-only
}
```

The list's hover cards need an `IdentityProfile`, but the summary lacks email/role, so a dedicated
adapter fills a public-safe profile (rather than reusing `identityProfileFromMember`, which would
show an empty email).

## The list renders the real cluster

```svelte
<!-- routes/projects/+page.svelte -->
{#each p.memberSummary.items.slice(0, 3) as m (m.userId)}
  <IdentityHoverCard profile={identityProfileFromMemberSummary(m)} … />
{/each}
{#if p.memberSummary.total > 3}<span>+{p.memberSummary.total - 3}</span>{/if}
```

Three real member avatars plus a `+N` overflow driven by the exact `total` — no more self-only
stack. (`ShellTopBar`'s fallback `Project` literal gained an empty `memberSummary` to satisfy the
type.)

## Verification

- `pnpm check` 0/0; `pnpm test` **276** (+2: summary mapping + the empty-payload default).
- Contract matched to Omega source (`{ items, total }`, public fields only).
- All 5 touched companions updated to multi-section + byte-verified.
- Live UI E2E pending (no headless Chrome): on the projects list, a shared project shows real
  member avatars + the correct overflow count.
