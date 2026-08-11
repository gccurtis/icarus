# src/lib/systems/identity-directory/resolvers.ts — breakdown

Companion to [resolvers.ts](resolvers.ts). Resolves any actor (a user id, a name, a
collaborator, a project member, or a bounded member-summary item) to the shared
`IdentityProfile` card shape used by hover
cards, the document bar, history, and the Info panel. Real users come from Omega's enriched
`GET /users/:id`; unknown names fall back to a stable mock card.

## Real-user resolution + cache

### `resolveFromUserId(userId, fallbackName)` — the enriched user endpoint

```ts
import type { DocumentCollaborator } from '$systems/documents/collaboration';
import { api } from '$data/api';
import type { IdentityProfile } from './types';
import { MOCK_IDENTITIES } from './mocks';

// Lightweight cache: userId → the resolved (real) profile. Cleared on project
// switch via the identity service boundary. Small enough to keep in memory.
const publicUserCache = new Map<string, IdentityProfile>();

/**
 * Resolve a real user's public profile from Omega's enriched `GET /users/:id`
 * ({id, kind, name, email, role, description, createdAt}). Falls back to the mock
 * name lookup only when the request fails (user outside the project, offline).
 */
export async function resolveFromUserId(userId: string, fallbackName: string): Promise<IdentityProfile> {
  const cached = publicUserCache.get(userId);
  if (cached) return cached;

  try {
    const user = await api<{
      id: string;
      kind?: string;
      name: string;
      email?: string;
      role?: string;
      description?: string;
      createdAt?: string;
    }>(`/users/${encodeURIComponent(userId)}`);
    const profile: IdentityProfile = {
      id: user.id || userId,
      kind: user.kind === 'persona' ? 'persona' : 'person',
      name: user.name || fallbackName,
      email: user.email,
      role: user.role ?? 'Project member',
      description: user.description ?? 'A collaborator with access to this project.',
      createdAt: user.createdAt,
      mock: false
    };
    publicUserCache.set(userId, profile);
    return profile;
  } catch {
    // API failed or user not in project — fall back to the mock name lookup.
    return getIdentityProfile(fallbackName);
  }
}

/** Clear the public user cache (called on project switch). */
export function clearIdentityCache(): void {
  publicUserCache.clear();
}

```

Fetches Omega's **enriched** `GET /users/:id` (`{id, kind, name, email, role, description,
createdAt}`) and returns a real (`mock: false`) profile straight from those fields — no more
mock enrichment. Results are cached per user id; the cache is cleared on project switch. On
failure (user outside the project, offline) it falls back to the mock name lookup.

## Mock fallback and adapters

### `getIdentityProfile`, `identityProfileFromCollaborator`, `identityProfileFromMember`

```ts
/** Resolve a mock actor through one shared boundary, with a stable fallback card. */
export function getIdentityProfile(name: string): IdentityProfile {
  const known = MOCK_IDENTITIES.find((profile) => profile.name === name);
  if (known) return known;
  // Synthesize a plain person card. Personas are no longer mock-classified here —
  // real personas resolve from the personas store (`$systems/personas`) or carry
  // `kind: 'persona'` from Omega's enriched `GET /users/:id` (see resolveFromUserId).
  return {
    id: `mock_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    kind: 'person',
    name,
    role: 'Project member',
    description: 'A collaborator with access to this project.',
    mock: true
  };
}

/** Adapt the live/mocked presence shape to the shared profile-card shape. */
export function identityProfileFromCollaborator(
  collaborator: DocumentCollaborator
): IdentityProfile {
  const known = MOCK_IDENTITIES.find((profile) => profile.name === collaborator.name);
  return {
    id: collaborator.id,
    kind: 'person',
    name: collaborator.name,
    email: collaborator.email,
    avatarUrl: collaborator.avatarUrl,
    role: collaborator.access,
    description: collaborator.current
      ? 'Editing this document in the current browser.'
      : 'Viewing this document now.',
    createdAt: known?.createdAt,
    mock: collaborator.mock
  };
}

/** Adapt a project member to the shared profile-card shape. */
export function identityProfileFromMember(member: {
  id: string;
  name: string;
  email: string;
  role: string;
}): IdentityProfile {
  const roleLabel: Record<string, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' };
  const knownPerson = MOCK_IDENTITIES.find((p) => p.name === member.name && p.kind === 'person');
  return {
    id: member.id,
    kind: 'person',
    name: member.name,
    email: member.email,
    role: roleLabel[member.role] ?? member.role,
    description: knownPerson?.description ?? 'A collaborator with access to this project.',
    createdAt: knownPerson?.createdAt,
    mock: knownPerson?.mock ?? false
  };
}

```

`getIdentityProfile` is the sync fallback: a known mock identity, or a synthesized plain **person**
card. Persona classification was retired here in Goal 3.4 — real personas resolve from the personas
store (`$systems/personas`) or carry `kind: 'persona'` from the enriched `GET /users/:id`. The two
`…From*` adapters map a live presence collaborator and a project member onto the same profile shape.
`MOCK_IDENTITIES` now holds only person fallbacks — real users resolve from the endpoint above.

### `identityProfileFromMemberSummary` — the projects-list avatar cluster

```ts
/** Adapt a bounded member-summary item (userId/name/avatarUrl only — no email/role) to
 *  the shared profile-card shape, for the projects-list avatar cluster. */
export function identityProfileFromMemberSummary(item: {
  userId: string;
  name: string;
  avatarUrl?: string;
}): IdentityProfile {
  const knownPerson = MOCK_IDENTITIES.find((p) => p.name === item.name && p.kind === 'person');
  return {
    id: item.userId,
    kind: 'person',
    name: item.name,
    avatarUrl: item.avatarUrl || undefined,
    role: knownPerson?.role ?? 'Project member',
    description: knownPerson?.description ?? 'A collaborator with access to this project.',
    createdAt: knownPerson?.createdAt,
    mock: knownPerson?.mock ?? false
  };
}
```

`identityProfileFromMemberSummary` adapts one bounded member-summary item — only `userId`,
`name`, and an optional `avatarUrl`, since Omega's summary carries no email or role — onto the
shared `IdentityProfile` card for the projects-list avatar cluster. It keys the id off
`userId`, always classifies the actor as a **person**, passes the `avatarUrl` through (empty
coerced to `undefined`), and fills `role`/`description`/`createdAt`/`mock` from a matching
person in `MOCK_IDENTITIES`, defaulting to a generic `'Project member'` card.
