import type { User } from '$data/session';
import type { Member } from '$data/projects';
import type { DocumentCollaborator } from '$systems/documents/collaboration';
import {
  getIdentityProfile,
  identityProfileFromCollaborator,
  identityProfileFromMember,
  type IdentityProfile
} from '$data/identity-directory';

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

export const UserService = new UserServiceImpl();
export type { IdentityProfile };
