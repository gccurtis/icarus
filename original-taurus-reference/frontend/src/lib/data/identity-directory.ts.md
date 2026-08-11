# src/lib/data/identity-directory.ts — breakdown

Companion to [identity-directory.ts](identity-directory.ts). A thin barrel that
re-exports the identity directory system. The actual implementation lives in
`src/lib/systems/identity-directory/`.

## Barrel re-export

### Forward everything from the identity-directory system

```ts
export * from '$systems/identity-directory/index';
```

This single-line barrel routes all identity types, mock data, and resolvers
through the `$data` alias.

## Underlying implementation: `src/lib/systems/identity-directory/`

The identity directory system splits across three files:

- **`types.ts`** — the `IdentityProfile` type: `id`, `kind` (`'person' |
  'persona'`), `name`, optional `email`/`avatarUrl`, `role`, `description`,
  optional `createdAt`, and `mock` flag. This is the single shared identity
  shape used by every surface (history entries, collaborator lists, member
  cards, persona previews).
- **`mocks.ts`** — the `MOCK_IDENTITIES` fixture array with 7 entries: Maya
  Chen, Owen Park, Dev (persons), Research verifier, Orbit Analysis Agent,
  Editorial agent, and Taurus (personas).
- **`resolvers.ts`** — resolution functions and the public-user cache.

### resolvers.ts

#### Public user cache

A `publicUserCache: Map<string, { id, name }>` avoids repeated `GET /users/:id`
calls for the same user. It is kept in memory and cleared on project switch via
`clearIdentityCache()`.

#### `resolveFromUserId(userId, fallbackName)` — async, with cache

The primary async resolution path, added in this change:

1. **Cache hit**: Returns immediately with mock-enriched profile fields (role,
   description, createdAt from `MOCK_IDENTITIES` if available; else defaults).
2. **Cache miss**: Calls `GET /users/:id` on Omega, caches the result, and
   enriches with known mock data.
3. **API failure**: Falls back to the synchronous `getIdentityProfile` using the
   `fallbackName`.

This gives history entries and presence cards a real name from Omega while
backfilling role and description from the mock fixture until the backend
supplies them.

#### `clearIdentityCache()`

Clears the `publicUserCache` map. Called from the identity service boundary
when the user switches projects, preventing stale cached user data from leaking
between projects.

#### `getIdentityProfile(name)` — synchronous, mock-only

The synchronous fallback resolver. Checks the mock fixture array for an exact
name match. If no match is found, checks against known persona names using
**strict equality** (no longer a regex substring test that could false-match
email domains like `dev@taurus.local`). Matching personae get persona metadata;
everything else gets a generic person card with `mock: true`.

#### `identityProfileFromCollaborator(collaborator)`

Converts a `DocumentCollaborator` (from the presence/collaboration store) into
the shared `IdentityProfile` shape. The `access` field becomes `role`;
description is derived from whether this is the current user or another viewer.

#### `identityProfileFromMember(member)`

Converts a project member (from `fetchMembers`) into the shared profile card
shape. Omega roles (`owner`/`editor`/`viewer`) are capitalized for display.
Known mock fixtures enrich role and description; unknown members get safe
defaults with `mock: false` for real members (or `mock: true` if a matching
mock fixture exists).

#### `mockDocumentCreator`

A convenience export resolved once at module load:
`getIdentityProfile('Maya Chen')`. Used by surfaces that need a document creator
profile before Omega exposes one.
