import { describe, it, expect } from 'vitest';
import { actionTitle, kindBreakdown, updatedSpan } from './lens-helpers';
import type { Resource, ResourceKind } from '$data/resources';

// The redaction rule's tests moved to features/shared/activity-access.test.ts with
// the rule itself (2026-07-29).
const resource = (over: Partial<Resource> & { id: string }): Resource => ({
  name: 'Doc',
  kind: 'document',
  updatedAt: 0,
  createdAt: 0,
  pinned: false,
  access: { projectWide: true, orgIds: [], userIds: [] },
  ...over
});

describe('multi-selection projections', () => {
  const label = (k: ResourceKind) => (k === 'slides' ? 'Slides' : 'Document');

  it('counts kinds, largest first', () => {
    const list = [
      resource({ id: '1' }),
      resource({ id: '2' }),
      resource({ id: '3', kind: 'slides' })
    ];
    expect(kindBreakdown(list, label)).toEqual([
      { kind: 'document', label: 'Document', count: 2 },
      { kind: 'slides', label: 'Slides', count: 1 }
    ]);
  });

  it('spans update times', () => {
    const list = [
      resource({ id: '1', updatedAt: 500 }),
      resource({ id: '2', updatedAt: 100 }),
      resource({ id: '3', updatedAt: 900 })
    ];
    expect(updatedSpan(list)).toEqual({ newest: 900, oldest: 100 });
  });

  it('has no span for an empty set', () => {
    expect(updatedSpan([])).toBeNull();
  });
});

describe('actionTitle', () => {
  it('capitalizes the event action', () => {
    expect(actionTitle('edited')).toBe('Edited');
    expect(actionTitle('created')).toBe('Created');
  });
});
