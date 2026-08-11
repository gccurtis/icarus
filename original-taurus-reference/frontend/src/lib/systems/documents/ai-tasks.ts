import { api } from '$data/api';

/**
 * Document-scoped agent-task client. Reads and creates real Omega agent tasks
 * (`/agent/tasks`, `/agent/plans`, `/agent/actions`) filtered to one document via
 * the server-side `?documentId=` projection. Replaces the mock AI-tasks array
 * that used to back the document's AI Tasks panel (Goal 3.5).
 */

export type AgentTaskMode = 'plan' | 'action';

export type AgentTaskState =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'canceled';

/** The subset of Omega's `Task` record the panel reads. */
export interface AgentTask {
  id: string;
  mode: AgentTaskMode;
  state: AgentTaskState;
  objective: string;
  targetDocumentId?: string;
  persona?: { id?: string; name?: string };
  plans?: Array<{ draft?: { summary?: string; steps?: unknown[] } }>;
  runs?: Array<{ state?: AgentTaskState; failure?: string }>;
  createdAt: string;
  updatedAt: string;
}

export type DocumentAiTaskStatus =
  | 'Queued'
  | 'Running'
  | 'Needs review'
  | 'Completed'
  | 'Partial'
  | 'Failed'
  | 'Canceled';

/** Flattened task for the panel — display strings only. */
export interface DocumentAiTask {
  id: string;
  title: string;
  detail: string;
  /** "Plan" or "Action" — the task mode. */
  scope: string;
  /** Persona name that owns the task. */
  actor: string;
  status: DocumentAiTaskStatus;
  /** True while the task is still in flight (non-terminal state). */
  active: boolean;
  updatedAt: string;
}

// Map each Omega task state to a display label + whether it counts as "active".
const STATUS: Record<AgentTaskState, { label: DocumentAiTaskStatus; active: boolean }> = {
  queued: { label: 'Queued', active: true },
  running: { label: 'Running', active: true },
  waiting: { label: 'Needs review', active: true },
  completed: { label: 'Completed', active: false },
  partially_completed: { label: 'Partial', active: false },
  failed: { label: 'Failed', active: false },
  canceled: { label: 'Canceled', active: false }
};

// Compose a human detail line from the richest available field: a run failure,
// then the latest plan draft's summary, then a mode/step-count fallback.
function detailFor(task: AgentTask): string {
  const run = task.runs?.[task.runs.length - 1];
  if (run?.failure) return run.failure;
  const draft = task.plans?.[task.plans.length - 1]?.draft;
  if (draft?.summary) return draft.summary;
  const steps = draft?.steps?.length ?? 0;
  if (task.mode === 'plan' && steps) return `Plan with ${steps} step${steps === 1 ? '' : 's'} for this document.`;
  return task.mode === 'plan'
    ? 'A plan scoped to this document.'
    : 'A direct action scoped to this document.';
}

/** Flatten Omega's task record into the panel's display shape. */
export function toDocumentAiTask(task: AgentTask): DocumentAiTask {
  const status = STATUS[task.state] ?? { label: 'Queued' as DocumentAiTaskStatus, active: true };
  return {
    id: task.id,
    title: task.objective,
    detail: detailFor(task),
    scope: task.mode === 'plan' ? 'Plan' : 'Action',
    actor: task.persona?.name || 'Agent',
    status: status.label,
    active: status.active,
    updatedAt: task.updatedAt
  };
}

/** Load the agent tasks whose target is this document (empty id → no tasks). */
export async function loadDocumentAiTasks(documentId: string): Promise<DocumentAiTask[]> {
  if (!documentId) return [];
  const res = await api<{ tasks: AgentTask[] }>(
    `/agent/tasks?documentId=${encodeURIComponent(documentId)}`
  );
  return (res.tasks ?? []).map(toDocumentAiTask);
}

export interface CreateDocumentAiTaskInput {
  documentId: string;
  objective: string;
  /** Persona to run the task under (Omega's `persona.personaId`). */
  personaId: string;
  personaVersion?: number;
  /** Plan (draft to accept) vs Action (edits directly). */
  mode: AgentTaskMode;
  /** Optional scope hint, attached as a context item. */
  scopeLabel?: string;
}

/**
 * Create a real document-scoped agent task. A `plan` posts to `/agent/plans`
 * (produces a draft plan to accept); an `action` posts to `/agent/actions`
 * (edits land via the `document.append_changes` tool). Returns the flattened task.
 */
export async function createDocumentAiTask(input: CreateDocumentAiTaskInput): Promise<DocumentAiTask> {
  const path = input.mode === 'plan' ? '/agent/plans' : '/agent/actions';
  const body = {
    objective: input.objective,
    persona: {
      personaId: input.personaId,
      ...(input.personaVersion ? { personaVersion: input.personaVersion } : {})
    },
    targetDocumentId: input.documentId,
    context: input.scopeLabel ? [{ label: 'Scope', content: input.scopeLabel }] : []
  };
  const task = await api<AgentTask>(path, { method: 'POST', body: JSON.stringify(body) });
  return toDocumentAiTask(task);
}
