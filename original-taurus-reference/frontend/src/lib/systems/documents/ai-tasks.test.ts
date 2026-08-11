import { describe, it, expect } from 'vitest';
import { toDocumentAiTask, type AgentTask, type AgentTaskState } from './ai-tasks';

function task(partial: Partial<AgentTask>): AgentTask {
  return {
    id: 't1',
    mode: 'action',
    state: 'queued',
    objective: 'Do the thing',
    createdAt: '2026-07-25T00:00:00Z',
    updatedAt: '2026-07-25T01:00:00Z',
    ...partial
  };
}

describe('toDocumentAiTask — state → status/active mapping', () => {
  const cases: [AgentTaskState, string, boolean][] = [
    ['queued', 'Queued', true],
    ['running', 'Running', true],
    ['waiting', 'Needs review', true],
    ['completed', 'Completed', false],
    ['partially_completed', 'Partial', false],
    ['failed', 'Failed', false],
    ['canceled', 'Canceled', false]
  ];
  for (const [state, label, active] of cases) {
    it(`${state} → ${label} (active=${active})`, () => {
      const t = toDocumentAiTask(task({ state }));
      expect(t.status).toBe(label);
      expect(t.active).toBe(active);
    });
  }

  it('defaults an unknown state to Queued/active (defensive)', () => {
    const t = toDocumentAiTask(task({ state: 'bogus' as AgentTaskState }));
    expect(t.status).toBe('Queued');
    expect(t.active).toBe(true);
  });
});

describe('toDocumentAiTask — field mapping', () => {
  it('maps objective→title, mode→scope, persona name→actor', () => {
    const t = toDocumentAiTask(task({ mode: 'plan', persona: { id: 'p', name: 'General' } }));
    expect(t.title).toBe('Do the thing');
    expect(t.scope).toBe('Plan');
    expect(t.actor).toBe('General');
  });

  it('falls back to "Action" scope and "Agent" actor', () => {
    const t = toDocumentAiTask(task({ mode: 'action', persona: undefined }));
    expect(t.scope).toBe('Action');
    expect(t.actor).toBe('Agent');
  });
});

describe('toDocumentAiTask — detail composition (richest field wins)', () => {
  it('prefers the latest run failure', () => {
    const t = toDocumentAiTask(
      task({
        state: 'failed',
        runs: [{ state: 'failed', failure: 'boom: could not reach source' }],
        plans: [{ draft: { summary: 'unused summary' } }]
      })
    );
    expect(t.detail).toBe('boom: could not reach source');
  });

  it('then the latest plan draft summary', () => {
    const t = toDocumentAiTask(
      task({ mode: 'plan', plans: [{ draft: { summary: 'A three-step plan.' } }] })
    );
    expect(t.detail).toBe('A three-step plan.');
  });

  it('then a plan step-count fallback', () => {
    const t = toDocumentAiTask(
      task({ mode: 'plan', plans: [{ draft: { steps: [{}, {}] } }] })
    );
    expect(t.detail).toBe('Plan with 2 steps for this document.');
  });

  it('singularizes a one-step plan', () => {
    const t = toDocumentAiTask(task({ mode: 'plan', plans: [{ draft: { steps: [{}] } }] }));
    expect(t.detail).toBe('Plan with 1 step for this document.');
  });

  it('finally a mode-based fallback sentence', () => {
    expect(toDocumentAiTask(task({ mode: 'action' })).detail).toBe(
      'A direct action scoped to this document.'
    );
    expect(toDocumentAiTask(task({ mode: 'plan' })).detail).toBe('A plan scoped to this document.');
  });
});
