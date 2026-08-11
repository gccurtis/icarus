import { describe, it, expect } from 'vitest';
import { mockPresentMembers } from './mocks';
import type { Member } from '$data/projects';

const member = (id: string): Member => ({
  id,
  name: `Member ${id}`,
  email: `${id}@example.com`,
  role: 'editor'
});

const roster = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'].map(member);

describe('mockPresentMembers', () => {
  it('is deterministic for a project — presence must not reshuffle on re-render', () => {
    const first = mockPresentMembers('p1', roster, 'u1');
    const second = mockPresentMembers('p1', roster, 'u1');
    expect(second.map((p) => p.userId)).toEqual(first.map((p) => p.userId));
  });

  it('differs between projects', () => {
    const a = mockPresentMembers('p1', roster, 'u1').map((p) => p.userId);
    const b = mockPresentMembers('p2', roster, 'u1').map((p) => p.userId);
    expect(a).not.toEqual(b);
  });

  it('never includes the current user — the caller adds them as a real entry', () => {
    for (const id of roster.map((m) => m.id)) {
      expect(mockPresentMembers('p1', roster, id).some((p) => p.userId === id)).toBe(false);
    }
  });

  it('only ever names real members', () => {
    const ids = new Set(roster.map((m) => m.id));
    expect(mockPresentMembers('p1', roster, 'u1').every((p) => ids.has(p.userId))).toBe(true);
  });

  it('marks every entry as mock', () => {
    expect(mockPresentMembers('p1', roster, 'u1').every((p) => p.mock)).toBe(true);
  });

  it('picks a subset, not everyone', () => {
    const picked = mockPresentMembers('p1', roster, 'u1');
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThan(roster.length - 1);
  });

  it('is empty without a project', () => {
    expect(mockPresentMembers('', roster, 'u1')).toEqual([]);
  });

  it('is empty for a roster of one (just you)', () => {
    expect(mockPresentMembers('p1', [member('u1')], 'u1')).toEqual([]);
  });
});
