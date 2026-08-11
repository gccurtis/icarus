import { describe, it, expect } from 'vitest';
import { REDACTED_LABEL, deletedTargetIds, isTargetRedacted } from './activity-access';
import type { ActivityEvent } from '$data/projects';

// Moved here with the rule itself on 2026-07-29 (from stages/overview/lens-helpers.test.ts)
// when the context rail's History lens needed it: the shell must not import from a stage.
const event = (over: Partial<ActivityEvent> & { targetId: string }): ActivityEvent => ({
  id: `e_${over.targetId}_${over.action ?? 'edited'}`,
  actor: { id: 'u1', name: 'Ana' },
  action: over.action ?? 'edited',
  target: { id: over.targetId, name: 'Secret plans', kind: 'document' },
  occurredAt: over.occurredAt ?? 0
});

describe('activity target redaction', () => {
  it('shows a target that is in the access-filtered catalog', () => {
    const visible = new Set(['r1']);
    expect(isTargetRedacted(event({ targetId: 'r1' }), visible, new Set())).toBe(false);
  });

  it('redacts a target absent from the catalog', () => {
    // Omega's /activity does no access check, so an event can name a resource
    // the catalog deliberately withheld. That is the case this closes.
    expect(isTargetRedacted(event({ targetId: 'r9' }), new Set(['r1']), new Set())).toBe(true);
  });

  it('does not redact a target the feed has reported deleted', () => {
    const deleted = deletedTargetIds([event({ targetId: 'r9', action: 'deleted' })]);
    expect(isTargetRedacted(event({ targetId: 'r9' }), new Set(), deleted)).toBe(false);
  });

  it('fails closed when the catalog is empty', () => {
    // An empty visible set must never read as "everything is fine" — callers
    // hold this off until resourcesLoaded, and the rule itself denies by default.
    expect(isTargetRedacted(event({ targetId: 'r1' }), new Set(), new Set())).toBe(true);
  });

  it('collects only deletion targets', () => {
    const ids = deletedTargetIds([
      event({ targetId: 'a', action: 'deleted' }),
      event({ targetId: 'b', action: 'edited' }),
      event({ targetId: 'c', action: 'created' })
    ]);
    expect([...ids]).toEqual(['a']);
  });

  it('is one word', () => {
    expect(REDACTED_LABEL).toBe('Redacted');
  });
});
