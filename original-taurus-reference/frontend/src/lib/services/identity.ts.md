# src/lib/services/identity.ts — breakdown

Companion to [identity.ts](identity.ts). Canonical identity resolution — one entry
point for all five user shapes (User, Member, DocumentCollaborator, ActivityActor,
and name-string actors).

## Imports

### The user-shape types and the identity-directory helpers

```ts
import type { User } from '$data/session';
import type { Member } from '$data/projects';
import type { DocumentCollaborator } from '$systems/documents/collaboration';
import {
  getIdentityProfile,
  identityProfileFromCollaborator,
  identityProfileFromMember,
  type IdentityProfile
} from '$data/identity-directory';

```

The type imports name the raw user shapes this service accepts. The value imports come
from `identity-directory.ts`, which owns the actual profile assembly — this service is a
thin façade over `getIdentityProfile`, `identityProfileFromMember`, and
`identityProfileFromCollaborator`. `IdentityProfile` is imported here and re-exported at
the bottom so callers get the type from one place.

## The UserServiceImpl class

### One resolver method per user shape

```ts
/**
 * Canonical identity resolution — one entry point for all five user shapes.
 *
 * Every surface that shows a person or AI persona asks this service for the
 * IdentityProfile. Features never assemble profile data themselves or know
 * which Omega routes own it. When Omega ships a real identity directory, only
 * this service changes; the resolve* signatures remain the same.
 */
class UserServiceImpl {
  /** Give the authenticated session user a rich IdentityProfile. */
  resolveFromSession(user: User): IdentityProfile {
    const profile = identityProfileFromMember({
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'owner'
    });
    return { ...profile, description: 'You are signed in to Taurus Alpha.' };
  }

  /** Resolve a project member. */
  resolveFromMember(member: Member): IdentityProfile {
    return identityProfileFromMember(member);
  }

  /** Resolve from a display name (historical actor, comment author, etc.). */
  resolveFromName(name: string): IdentityProfile {
    return getIdentityProfile(name);
  }

  /** Resolve a document presence collaborator. */
  resolveFromCollaborator(collaborator: DocumentCollaborator): IdentityProfile {
    return identityProfileFromCollaborator(collaborator);
  }
}

```

Each `resolve*` method maps a distinct user shape onto the single `IdentityProfile`
type. `resolveFromSession` is the one that adds value beyond delegation: it treats the
authenticated user as an `owner` member and appends a "You are signed in" description,
giving the session user a rich profile for the first time. `resolveFromMember`,
`resolveFromName`, and `resolveFromCollaborator` are thin passes through to the
directory helpers, so every surface collapses onto one resolution path.

## Exports

### The shared singleton and the profile type

```ts
export const UserService = new UserServiceImpl();
export type { IdentityProfile };
```

The class is instantiated once and exported as `UserService` — features import the
singleton rather than constructing their own. `IdentityProfile` is re-exported so a
caller can type its return values without reaching into `identity-directory.ts`.
