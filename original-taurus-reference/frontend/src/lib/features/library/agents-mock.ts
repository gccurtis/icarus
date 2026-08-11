/**
 * MOCK fixtures behind the Agents space (`/library/agents`).
 *
 * The screens are real and shipped; the data behind them is not. Everything
 * renders under the shell's Mock badge. Shapes mirror Omega where Omega has
 * them, so the UI cannot quietly assume something the backend cannot express:
 *
 * - a personality mirrors `Persona` + `PersonaDefinition`
 *   (`$systems/personas/types.ts` ↔ Omega `GET /personas`), including versions
 *   (`personas.revise` / `personas.versions`) and the per-persona task history
 *   (`GET /personas/:personaID/tasks` — real, project-scoped);
 * - a task mirrors `AiTask` (`$systems/ai-agent/types.ts` ↔ Omega agent tasks):
 *   state machine, todos, plan draft, failure.
 *
 * Three things here have NO Omega equivalent, and are the backend ask this
 * design implies: **owner scope** (personas are project-scoped, like contexts
 * and templates were), **cross-project task listing** (`GET /agent/tasks` is
 * project-scoped; the monitor here spans projects, so each task carries an
 * invented `project` field), and **messaging a running task** (Omega has
 * create/get/list/accept-plan only — the composer is a mock).
 */

import { get, writable } from 'svelte/store';
import type { AiTaskState, AiTodo } from '$systems/ai-agent/types';
import type { PersonaDefinition } from '$systems/personas/types';
import type { Shared } from './library-mock';

/** One line of an agent exchange — the shape `TaskExchange` renders. */
export type TaskLine = { author: 'you' | 'agent'; body: string };

/** A personality: a persona plus the library-asset identity fields
 *  (owner/sharing/origin), so `LibraryDetails` renders it unchanged. */
export type Personality = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  sharedWith: Shared[];
  /** Current definition (Omega `PersonaDefinition`, flattened persona version). */
  definition: PersonaDefinition;
  version: number;
  isDefault: boolean;
  origin: { project: string; date: string };
  usedIn: string[];
  lastEdited: string;
  editedBy: string;
};

/** One monitored agent task. Everything but `project` mirrors `AiTask`. */
export type AgentTask = {
  id: string;
  mode: 'plan' | 'action';
  state: AiTaskState;
  objective: string;
  personalityId: string;
  /** INVENTED: which project the task runs in — Omega's list is project-scoped. */
  project: string;
  todos: AiTodo[];
  failure?: string;
  started: string;
  updated: string;
  /** The running exchange, so "communicate with a task" has something to show. */
  transcript: TaskLine[];
};

/**
 * Omega's `TaskState` → the shell's explicit state language (`StatePill`). One
 * map, imported by every surface that shows a task, so a running agent reads the
 * same in the monitor, in a personality's history, and in the detail panel.
 */
export const TASK_PILL: Record<
  AiTaskState,
  {
    state: 'resolving' | 'running' | 'needs-review' | 'applied' | 'failed' | 'stale';
    label: string;
  }
> = {
  queued: { state: 'resolving', label: 'Queued' },
  running: { state: 'running', label: 'Running' },
  waiting: { state: 'needs-review', label: 'Needs you' },
  completed: { state: 'applied', label: 'Done' },
  partially_completed: { state: 'stale', label: 'Partial' },
  failed: { state: 'failed', label: 'Failed' },
  canceled: { state: 'stale', label: 'Canceled' }
};

export const PERSONALITIES: Personality[] = [
  {
    id: 'per-analyst',
    name: 'Analyst',
    description: 'Careful, evidence-first research work. Cites everything.',
    ownerId: 'you',
    sharedWith: [{ id: 'org-atlas', name: 'Atlas Research', kind: 'org', access: 'Can use' }],
    definition: {
      focus: 'Research synthesis: weigh sources, separate claims from evidence, surface gaps.',
      behavioralGuidance:
        'Never assert without a source. Prefer primary material over summaries. State confidence plainly, and say what would change the conclusion.',
      outputPreferences: 'Findings as claim → evidence → confidence. Short paragraphs, no filler.',
      defaultVerification: 'Every claim traces to a cited span.'
    },
    version: 4,
    isDefault: true,
    origin: { project: 'Helios', date: '6 Jul 2026' },
    usedIn: ['Helios', 'Vanguard'],
    lastEdited: '3 days ago',
    editedBy: 'You'
  },
  {
    id: 'per-editor',
    name: 'Copy editor',
    description: 'House style enforcement: tone, clarity, and approved claims only.',
    ownerId: 'org-atlas',
    sharedWith: [{ id: 'u-rivera', name: 'Sam Rivera', kind: 'user', access: 'Can edit' }],
    definition: {
      focus: 'Editing customer-facing copy against the brand voice.',
      behavioralGuidance:
        'Rewrite, do not rewrite the meaning. Flag any claim not in the approved register instead of softening it yourself.',
      outputPreferences: 'The edited text first; a short change list after.',
      defaultVerification: 'No unapproved claims survive the edit.'
    },
    version: 7,
    isDefault: false,
    origin: { project: 'Brandmark', date: '18 Feb 2026' },
    usedIn: ['Brandmark', 'Helios', 'Orbit'],
    lastEdited: '2 weeks ago',
    editedBy: 'Sam Rivera'
  },
  {
    id: 'per-planner',
    name: 'Planner',
    description: 'Breaks goals into reviewable, dependency-ordered plans.',
    ownerId: 'you',
    sharedWith: [],
    definition: {
      focus: 'Decomposition: turn an objective into steps someone can actually review.',
      behavioralGuidance:
        'Steps must be independently checkable. Name the dependency when order matters; never bury a decision inside a step.',
      outputPreferences: 'Numbered steps, one sentence each, risks called out at the end.'
    },
    version: 2,
    isDefault: false,
    origin: { project: 'Vanguard', date: '2 Jun 2026' },
    usedIn: ['Vanguard'],
    lastEdited: '5 days ago',
    editedBy: 'You'
  },
  {
    id: 'per-support',
    name: 'Support triage',
    description: 'Reads support transcripts and routes what matters.',
    ownerId: 'org-northwind',
    sharedWith: [],
    definition: {
      focus: 'Triage: cluster incoming tickets, surface regressions, draft replies.',
      behavioralGuidance: 'Escalate anything mentioning data loss immediately; never guess at refunds.',
      outputPreferences: 'A ranked list with counts, then the three worst verbatims.'
    },
    version: 1,
    isDefault: false,
    origin: { project: 'Orbit', date: '11 May 2026' },
    usedIn: ['Orbit'],
    lastEdited: '1 month ago',
    editedBy: 'Ada Okafor'
  }
];

export const TASKS: AgentTask[] = [
  {
    id: 'task-q3-synthesis',
    mode: 'action',
    state: 'running',
    objective: 'Synthesise the Q3 interviews into a findings draft',
    personalityId: 'per-analyst',
    project: 'Helios',
    todos: [
      { id: 't1', text: 'Read all 14 transcripts', state: 'done' },
      { id: 't2', text: 'Cluster recurring complaints', state: 'done' },
      { id: 't3', text: 'Draft findings with citations', state: 'doing' },
      { id: 't4', text: 'Cross-check against the pricing teardown', state: 'open' }
    ],
    started: '18 min ago',
    updated: '40 s ago',
    transcript: [
      { author: 'agent', body: 'Clustered 14 transcripts into 6 recurring themes; drafting findings now, citing per claim.' },
      { author: 'you', body: 'Weight the enterprise interviews heavier than the trials.' },
      { author: 'agent', body: 'Reweighted — two themes swapped rank. Continuing the draft.' }
    ]
  },
  {
    id: 'task-launch-plan',
    mode: 'plan',
    state: 'waiting',
    objective: 'Plan the launch-note production from the launch inputs',
    personalityId: 'per-planner',
    project: 'Helios',
    todos: [
      { id: 't1', text: 'Inventory the launch inputs', state: 'done' },
      { id: 't2', text: 'Propose section-by-section plan', state: 'done' },
      { id: 't3', text: 'Awaiting plan review', state: 'blocked', detail: 'Needs your acceptance' }
    ],
    started: '1 h ago',
    updated: '12 min ago',
    transcript: [
      { author: 'agent', body: 'Plan drafted: 7 steps, two flagged risks (missing pricing sign-off, stale screenshots). Ready for review.' }
    ]
  },
  {
    id: 'task-brand-sweep',
    mode: 'action',
    state: 'running',
    objective: 'Sweep the Orbit help centre for off-voice copy',
    personalityId: 'per-editor',
    project: 'Orbit',
    todos: [
      { id: 't1', text: 'Crawl 212 articles', state: 'done' },
      { id: 't2', text: 'Flag off-voice passages', state: 'doing' },
      { id: 't3', text: 'Draft rewrites for the worst 20', state: 'open' }
    ],
    started: '52 min ago',
    updated: '3 min ago',
    transcript: [
      { author: 'agent', body: '61 of 212 articles reviewed; 9 flagged so far, mostly unapproved reliability claims.' }
    ]
  },
  {
    id: 'task-ticket-cluster',
    mode: 'action',
    state: 'completed',
    objective: 'Cluster last week’s support tickets',
    personalityId: 'per-support',
    project: 'Orbit',
    todos: [
      { id: 't1', text: 'Ingest 480 tickets', state: 'done' },
      { id: 't2', text: 'Cluster and rank', state: 'done' },
      { id: 't3', text: 'Draft the weekly summary', state: 'done' }
    ],
    started: 'yesterday',
    updated: 'yesterday',
    transcript: [
      { author: 'agent', body: 'Done: 480 tickets in 11 clusters. Top three: export timeouts, seat-limit confusion, webhook retries.' }
    ]
  },
  {
    id: 'task-competitor-refresh',
    mode: 'action',
    state: 'failed',
    objective: 'Refresh the competitor filings summary',
    personalityId: 'per-analyst',
    project: 'Vanguard',
    todos: [
      { id: 't1', text: 'Pull new filings since June', state: 'done' },
      { id: 't2', text: 'Summarise deltas', state: 'canceled' }
    ],
    failure: 'The SEC filings source stopped answering after 3 retries.',
    started: '2 days ago',
    updated: '2 days ago',
    transcript: [
      { author: 'agent', body: 'Pulled 4 new filings, then the source began timing out. Stopping rather than summarising a partial set.' }
    ]
  }
];

export const personalityById = (id: string) => PERSONALITIES.find((p) => p.id === id);

/** Active = anything not yet settled, the monitor's top group. */
export const ACTIVE_STATES: AiTaskState[] = ['queued', 'running', 'waiting'];

/**
 * The monitor reads a STORE, not the seed array, because starting an agent has
 * to put a row in front of you — a "new agent" flow whose result you cannot see
 * is not a flow. Seeded from `TASKS`; nothing persists past a reload, which is
 * honest about there being no backend behind it.
 */
export const agentTasks = writable<AgentTask[]>(TASKS);

export const tasksFor = (list: AgentTask[], personalityId: string) =>
  list.filter((t) => t.personalityId === personalityId);

let started = 0;

/**
 * Start an agent from the New-agent lens. Queued, never running: the library
 * cannot actually launch anything, and the task's own first line says so rather
 * than leaving a fabricated agent apparently at work.
 */
export function startAgentTask(args: {
  project: string;
  personalityId: string;
  objective: string;
  mode: 'plan' | 'action';
}): AgentTask {
  const task: AgentTask = {
    id: `task-new-${++started}`,
    mode: args.mode,
    state: 'queued',
    objective: args.objective,
    personalityId: args.personalityId,
    project: args.project,
    todos: [],
    started: 'just now',
    updated: 'just now',
    transcript: [
      {
        author: 'you',
        body: args.objective
      },
      {
        author: 'agent',
        body: 'Queued — but the library cannot start agents yet, so nothing is actually running.'
      }
    ]
  };
  agentTasks.update((list) => [task, ...list]);
  return task;
}

/**
 * Continue an existing exchange. Selecting a task points the bar AT that agent —
 * talking to one is not starting one — so a send lands here instead of in
 * `startAgentTask`.
 *
 * The reply is the honest part: Omega's task API is create/get/list/accept-plan,
 * with **no way to message a running task**, so the line is recorded and then
 * says it went nowhere. A silent append would read as delivered.
 */
export function messageAgentTask(taskId: string, body: string): void {
  agentTasks.update((list) =>
    list.map((t) =>
      t.id === taskId
        ? {
            ...t,
            updated: 'just now',
            transcript: [
              ...t.transcript,
              { author: 'you', body } as TaskLine,
              {
                author: 'agent',
                body: 'Not delivered — there is no endpoint yet for messaging a running task.'
              } as TaskLine
            ]
          }
        : t
    )
  );
}

/** Read-only peek for callers that need the list without subscribing. */
export const currentTasks = () => get(agentTasks);
