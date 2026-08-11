import { describe, it, expect } from 'vitest';
import type { Member } from '$data/projects';
import { UserService } from '../services/identity';

describe('UserService', () => {
  describe('resolveFromName', () => {
    it('resolves a known person mock identity', () => {
      const profile = UserService.resolveFromName('Maya Chen');
      expect(profile.id).toBe('mock_maya');
      expect(profile.kind).toBe('person');
      expect(profile.name).toBe('Maya Chen');
      expect(profile.email).toBe('maya@mock.taurus.local');
      expect(profile.role).toBe('Research lead');
      expect(profile.mock).toBe(true);
    });

    it('resolves an unknown name to a synthesized person (personas come from the personas store now)', () => {
      // Mock persona identities were retired in Goal 3.4 — name resolution no
      // longer classifies any name as a persona.
      const profile = UserService.resolveFromName('Taurus');
      expect(profile.kind).toBe('person');
      expect(profile.name).toBe('Taurus');
      expect(profile.mock).toBe(true);
    });

    it('returns a fallback for unknown names (person)', () => {
      const profile = UserService.resolveFromName('Unknown User');
      expect(profile.kind).toBe('person');
      expect(profile.name).toBe('Unknown User');
      expect(profile.mock).toBe(true);
      expect(profile.description).toContain('collaborator');
    });

    it('defaults unknown names to person', () => {
      const profile = UserService.resolveFromName('Test Agent');
      expect(profile.kind).toBe('person');
      expect(profile.name).toBe('Test Agent');
      expect(profile.mock).toBe(true);
    });
  });

  describe('resolveFromMember', () => {
    it('resolves a member matching a known mock identity', () => {
      const member: Member = { id: 'u_1', name: 'Maya Chen', email: 'maya@mock.taurus.local', role: 'editor' };
      const profile = UserService.resolveFromMember(member);
      expect(profile.id).toBe(member.id);
      expect(profile.kind).toBe('person');
      expect(profile.email).toBe(member.email);
      expect(profile.role).toBe('Editor');
      expect(profile.mock).toBe(true);
    });

    it('resolves a member with no mock match', () => {
      const member: Member = { id: 'u_new', name: 'New Person', email: 'new@test.com', role: 'viewer' };
      const profile = UserService.resolveFromMember(member);
      expect(profile.id).toBe(member.id);
      expect(profile.kind).toBe('person');
      expect(profile.role).toBe('Viewer');
      expect(profile.mock).toBe(false);
    });

    it('maps owner role', () => {
      const member: Member = { id: 'u_own', name: 'Owner', email: 'o@t.com', role: 'owner' };
      const profile = UserService.resolveFromMember(member);
      expect(profile.role).toBe('Owner');
    });
  });

  describe('resolveFromSession', () => {
    it('gives the session user a profile', () => {
      const user = { id: 'session-1', name: 'Dev', email: 'dev@taurus.local' };
      const profile = UserService.resolveFromSession(user);
      expect(profile.id).toBe('session-1');
      expect(profile.kind).toBe('person');
      expect(profile.name).toBe('Dev');
      expect(profile.description).toBe('You are signed in to Taurus Alpha.');
    });

    it('gives unknown session users a profile', () => {
      const user = { id: 'session-2', name: 'Brand New', email: 'new@test.com' };
      const profile = UserService.resolveFromSession(user);
      expect(profile.kind).toBe('person');
      expect(profile.name).toBe('Brand New');
    });
  });

  describe('resolveFromCollaborator', () => {
    it('resolves a current collaborator', () => {
      const collaborator = {
        id: 'coll-1',
        name: 'Dev',
        email: 'dev@taurus.local',
        access: 'You' as const,
        current: true,
        mock: false
      };
      const profile = UserService.resolveFromCollaborator(collaborator);
      expect(profile.kind).toBe('person');
      expect(profile.description).toContain('current browser');
    });

    it('resolves a viewer collaborator', () => {
      const collaborator = {
        id: 'coll-2',
        name: 'Owen Park',
        email: 'owen@mock.taurus.local',
        access: 'Viewer' as const,
        current: false,
        mock: true
      };
      const profile = UserService.resolveFromCollaborator(collaborator);
      expect(profile.role).toBe('Viewer');
      expect(profile.description).toContain('Viewing');
      expect(profile.mock).toBe(true);
    });
  });
});
