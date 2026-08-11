# Identity profile manager

**Status:** Partially implemented — shared UI contract and mock directory exist;
backend-backed resolution remains.

## Goal

Every surface that shows a person or AI persona should ask one front-end identity
manager for the summary needed by an avatar, name, or hover card. Feature components
should not independently assemble profile data or know which Taurus Omega route owns
it. The shared presentation exists today in
`DocumentIdentityHoverCard.svelte`; `src/lib/data/identity-directory.ts` is its
temporary mock-backed boundary.

## Intended boundary

The manager should resolve a stable discriminated identity such as:

```ts
type IdentityProfile = {
  id: string;
  kind: 'person' | 'persona';
  name: string;
  email?: string;
  avatarUrl?: string;
  role: string;
  description: string;
  createdAt?: string;
};
```

Callers should be able to request one profile or a batch by stable identity reference.
The manager should deduplicate in-flight requests, cache bounded public summaries,
invalidate entries when membership/persona data changes, and return a safe fallback
when a historical actor has been deleted or is no longer visible. Components receive
profiles; they do not fetch.

## Source integration

People may currently arrive through authentication, project membership, Activity,
comments, or document presence. AI personas may arrive through persona configuration,
AI tasks, generated changes, or Activity. Omega owns the final APIs, but those sources
need stable actor references and a common public-profile projection so Alpha can merge
them without name-based guessing.

Creation attribution needs the same reference: a document should expose its creator
identity alongside `createdAt`, while history/task rows should expose the actor that
performed or owns the work. Email and avatar fields remain nullable and authorization
must limit profile fields to what the current project member may see.

## Migration

1. Replace the name-keyed mock fixtures with an identity-directory client and cache.
2. Adapt document presence, creator attribution, comments, AI tasks, and history to
   stable person/persona ids at the data boundary.
3. Keep `DocumentIdentityHoverCard.svelte` presentation-only and remove **Mock** per
   profile when its backing source is real.
4. Add tests for batching, stale/deleted actors, authorization, nullable images, and
   both person and persona cards.
