import { aiModeOptions, type AiMode, type AiTaskState, type AiTodoState } from '$data/ai-agent';
import { documentEditRelative } from '$data/time';
import type { Tone } from '$lib/components';

/**
 * Pure display helpers shared by the Quarterback panel's sub-components —
 * the lens-helpers of the A3 decomposition. Nothing here reads a store.
 */

/** Chat-mode badge tone (the list shows a chat's fixed mode, not a live status). */
export const modeTones: Record<AiMode, Tone> = { ask: 'neutral', action: 'focus', plan: 'attention' };

export function modeName(mode: AiMode): string {
  return aiModeOptions.find((o) => o.value === mode)?.label ?? mode;
}

/** Task-state → label + tone for the spawned-task card. */
export const taskLabels: Record<AiTaskState, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting: 'Needs review',
  completed: 'Completed',
  partially_completed: 'Partial',
  failed: 'Failed',
  canceled: 'Canceled'
};
export const taskTones: Record<AiTaskState, Tone> = {
  queued: 'neutral',
  running: 'focus',
  waiting: 'attention',
  completed: 'success',
  partially_completed: 'attention',
  failed: 'danger',
  canceled: 'neutral'
};
export const todoMarks: Record<AiTodoState, string> = {
  open: '○',
  doing: '◐',
  done: '●',
  blocked: '▲',
  canceled: '×'
};

export function relTime(iso: string): string {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? documentEditRelative(at) : '';
}
