import { get, writable } from 'svelte/store';
import type { AiMode, AiPersona } from '$data/ai-agent';
import { PROJECTS } from './library-mock';
import { PERSONALITIES, messageAgentTask, startAgentTask } from './agents-mock';

/**
 * The library AI surface's state — the composer at the foot of the work surface
 * and the **Agent** lens on the right are ONE surface, so they share this store
 * the way `QuarterbackDock` and `QuarterbackPanel` share `aiAgent`.
 *
 * Every library send is a whole agent request, not a chat: it runs somewhere
 * (`project`), as someone (`personalityId`, driven by the bar's persona picker),
 * over something (`contexts`). The lens holds the parts the bar cannot express;
 * the bar holds mode, persona, web, and the text.
 *
 * **It is a mock.** Every agent route in Omega sits behind `requireProject`, and
 * the library deliberately stands outside any one project, so there is no
 * endpoint a library turn could honestly call. Filed in
 * `docs/backend-requests/agents-console-scope.md`.
 */

export type LibrarySpace = 'agents' | 'context' | 'templates';

export type AssistantTurn = { id: number; author: 'you' | 'agent'; body: string };

/** The reserved "no project" scope. Omega will back this with a per-user,
 *  unshareable internal project so library work always has somewhere to run. */
export const NO_PROJECT = 'none';

export const projectOptions = [
  { value: NO_PROJECT, label: 'None' },
  ...PROJECTS.map((p) => ({ value: p, label: p }))
];

export type AssistantState = {
  /** True once the user has engaged the surface — the panel shows the Agent lens. */
  open: boolean;
  mode: AiMode;
  web: boolean;
  turns: AssistantTurn[];
  sending: boolean;
  /** Where it runs, as whom, and the extra contexts it reads. The asset you are
   *  looking at is always in scope and is not listed here. */
  draft: { project: string; personalityId: string; contexts: string[] };
};

const fresh = (): AssistantState => ({
  open: false,
  mode: 'ask',
  web: false,
  turns: [],
  sending: false,
  draft: { project: NO_PROJECT, personalityId: defaultPersonalityId(), contexts: [] }
});

function defaultPersonalityId(): string {
  return (PERSONALITIES.find((p) => p.isDefault) ?? PERSONALITIES[0]).id;
}

export const assistant = writable<AssistantState>(fresh());

/** The bar's persona picker is the personality picker — one control, not two. */
export const personaOptions: AiPersona[] = PERSONALITIES.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description
}));

/**
 * Per-mode placeholders. The bar's defaults name the open document.
 *
 * On Agents the bar has two jobs, and the placeholder is where it admits which
 * one is live: with a task selected it continues that exchange, and with nothing
 * selected it starts a new agent — said expressly, because "what should the agent
 * do?" reads the same either way.
 */
export function placeholdersFor(
  space: LibrarySpace,
  /** The agent the bar is addressing, when a task is selected. */
  target?: string | null
): Partial<Record<AiMode, string>> {
  if (space === 'agents') {
    if (target)
      return {
        ask: `Ask ${target} about this task…`,
        action: `Tell ${target} what to do next…`,
        plan: `Ask ${target} to revise the plan…`
      };
    return {
      ask: 'Start a new agent to look into…',
      action: 'Start a new agent to…',
      plan: 'Start a new agent to plan…'
    };
  }
  if (space === 'context') {
    return {
      ask: 'Ask about this context…',
      action: 'Describe what to include or exclude…',
      plan: 'Describe the context to build…'
    };
  }
  return {
    ask: 'Ask about this template…',
    action: 'Describe a change to the template…',
    plan: 'Describe the template to draft…'
  };
}

/** Per-mode cue. The shared `aiModeCopy` cues describe editing a document. */
export function cuesFor(space: LibrarySpace, target?: string | null): Record<AiMode, string> {
  if (space === 'agents' && target) {
    return {
      ask: `Ask ${target} about this task — it answers from the work it has already done.`,
      action: 'Steer this task. Nothing new is started; the same agent carries on.',
      plan: 'Ask for a revised plan on this task before it goes any further.'
    };
  }
  if (space === 'agents') {
    return {
      ask: 'Start a new agent that investigates and reports back.',
      action: 'Start a new agent that does the work directly.',
      plan: 'Start a new agent that proposes a plan for you to review first.'
    };
  }
  if (space === 'context') {
    return {
      ask: 'Answer from this context and anything else you add below.',
      action: 'Propose members to include or exclude, and show the resolved set before it changes.',
      plan: 'Turn a description of the material you need into a context you can review.'
    };
  }
  return {
    ask: 'Answer from this template — its structure, prompt blocks, and slots.',
    action: 'Change the template directly: sections, prompt blocks, the context it needs.',
    plan: 'Turn an outcome into a template you can review before it is saved.'
  };
}

export const openAssistant = () => assistant.update((s) => ({ ...s, open: true }));
export const closeAssistant = () => assistant.update((s) => ({ ...s, open: false }));
export const setAssistantMode = (mode: AiMode) => assistant.update((s) => ({ ...s, mode }));
export const setAssistantWeb = (web: boolean) => assistant.update((s) => ({ ...s, web }));

export const setDraftProject = (project: string) =>
  assistant.update((s) => ({ ...s, draft: { ...s.draft, project } }));

export const setDraftPersonality = (personalityId: string) =>
  assistant.update((s) => ({ ...s, draft: { ...s.draft, personalityId } }));

export const addDraftContext = (id: string) =>
  assistant.update((s) => ({
    ...s,
    draft: {
      ...s.draft,
      contexts: s.draft.contexts.includes(id) ? s.draft.contexts : [...s.draft.contexts, id]
    }
  }));

export const removeDraftContext = (id: string) =>
  assistant.update((s) => ({
    ...s,
    draft: { ...s.draft, contexts: s.draft.contexts.filter((x) => x !== id) }
  }));

/**
 * Reset when the space changes — a conversation about a context means nothing on
 * the templates screen. `personalityId` is re-seeded by the console when a
 * personality is open, so the bar defaults to the one you are looking at.
 */
export const resetAssistant = () => assistant.set(fresh());

let nextId = 1;

/** What the reply WOULD be, per space and mode, before the honest tail. */
function intent(space: LibrarySpace, mode: AiMode, assetName: string): string {
  if (mode === 'ask') return `I'd answer that from ${assetName} and the context you set`;
  if (space === 'context')
    return `I'd propose members to include or exclude in ${assetName}, and show you the resolved set before anything changed`;
  return `I'd draft that into ${assetName} — structure, prompt blocks, and the context slots it needs`;
}

/**
 * Sending. On **Agents** the bar has two destinations, and the selected task
 * decides which: with one selected the send continues THAT exchange (you are
 * talking to an agent, not starting one) and the lens stays open so the new line
 * lands in front of you; with nothing selected it starts a task and returns its
 * id for the console to select. Elsewhere it is a mocked exchange.
 */
export function submitLibraryPrompt(
  space: LibrarySpace,
  prompt: string,
  mode: AiMode,
  assetName: string,
  /** Agents only: the task the bar is addressing. */
  taskId?: string | null
): string | null {
  const body = prompt.trim();
  if (!body) return null;

  if (space === 'agents') {
    if (taskId) {
      messageAgentTask(taskId, body);
      // Nothing started, and nothing to select — the task is already selected and
      // the Agent lens is already showing the exchange this line joined.
      return null;
    }
    const { draft } = get(assistant);
    const task = startAgentTask({
      project: draft.project === NO_PROJECT ? 'No project' : draft.project,
      personalityId: draft.personalityId,
      objective: body,
      // Ask has no durable-task equivalent; an investigating agent is an action.
      mode: mode === 'plan' ? 'plan' : 'action'
    });
    closeAssistant();
    return task.id;
  }

  openAssistant();
  assistant.update((s) => ({
    ...s,
    mode,
    turns: [...s.turns, { id: nextId++, author: 'you', body }]
  }));
  // Deliberately synchronous — a fake "thinking" delay would be theatre on a mock.
  assistant.update((s) => ({
    ...s,
    turns: [
      ...s.turns,
      {
        id: nextId++,
        author: 'agent',
        body: `${intent(space, mode, assetName)} — but the library has no agent backend yet, so nothing has changed.`
      }
    ]
  }));
  return null;
}
