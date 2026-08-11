/**
 * AI Agent dock — UI types over Omega's real chat + agent-task model.
 *
 * A dock conversation is an Omega **chat** (`/agent/chats`) with ordered **turns**
 * (`role: user | agent`). An `action`/`plan` turn spawns a durable **task** the
 * client polls (`/agent/tasks/:id`); the agent turn carries its `taskId`. Plan
 * tasks expose a reviewable draft the user can accept.
 */

/** The three conversation modes (maps 1:1 to Omega chat `mode`). */
export type AiMode = 'ask' | 'action' | 'plan';

/** Which pane the dock shows. */
export type AiAgentView = 'chats' | 'conversation';

/** A selectable agent persona (Omega `Persona`). A chat carries a `personaId` set
 *  via `PATCH /agent/chats/:id/persona`; the dock's picker sets it **per chat**, and a
 *  spawned task inherits its chat's persona. An empty chat persona falls back to the
 *  requester's default (`/personas/default`). */
export type AiPersona = {
  id: string;
  name: string;
  description: string;
};

/** Context toggles offered in the dock. Only `document` (the chat's pinned
 *  resource) reaches the backend today; selection / knowledge / sources are
 *  surfaced but badged as not-yet-applied (see B2b). The live-web flag is a
 *  separate per-turn control (`webEnabled`), not a context source. */
export type AiContextSourceId = 'document' | 'selection' | 'knowledge' | 'sources';

/** One context toggle offered in the dock (label + hint for the picker). `wired`
 *  marks the sources that actually reach the backend today (only `document`). */
export type AiContextSource = {
  id: AiContextSourceId;
  label: string;
  detail: string;
  wired: boolean;
};

/** One message in a conversation (an Omega turn). `taskId` is set on the agent
 *  turn that spawned a durable task. */
export type AiMessage = {
  id: string;
  author: 'user' | 'agent';
  body: string;
  taskId?: string;
};

/** A chat summary for the list (Omega `Chat` — no preview/last-message field). */
export type AiChat = {
  id: string;
  title: string;
  mode: AiMode;
  resourceId?: string;
  /** The chat's selected persona id (Omega `Chat.personaId`). Empty/undefined means
   *  the requester's default persona; a spawned task inherits it. */
  personaId?: string;
  updatedAt: string;
};

/** One chat attachment (Omega `Attachment`). Chat-scoped; Omega feeds a text
 *  attachment (≤32KB) to the turn as context. `kind` is a single file or an
 *  uploaded directory. */
export type AiAttachment = {
  id: string;
  name: string;
  kind: 'file' | 'directory';
  /** Set for directory-upload members (their path within the folder). */
  relativePath?: string;
};

/** The synchronous result of posting one turn. */
export type AiTurnResult = {
  userMessage: AiMessage;
  agentMessage: AiMessage;
  usage: { promptTokens: number; totalTokens: number };
};

/** A task's lifecycle state (Omega `TaskState`). */
export type AiTaskState =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'canceled';

/** A task-local to-do state (Omega `TodoState`). */
export type AiTodoState = 'open' | 'doing' | 'done' | 'blocked' | 'canceled';

/** One item on a task's working list. */
export type AiTodo = { id: string; text: string; state: AiTodoState; detail?: string };

/** One step of a reviewable plan draft. */
export type AiPlanStep = { id: string; title: string; description: string };

/** A reviewable plan draft produced by Plan mode (the latest revision). */
export type AiPlanDraft = {
  revisionId: string;
  title: string;
  summary: string;
  steps: AiPlanStep[];
  /** Omega revision state ("draft" until accepted). */
  state: string;
  accepted: boolean;
};

/** The dock's view of a spawned agent task (state + working list + plan draft). */
export type AiTask = {
  id: string;
  mode: 'plan' | 'action';
  state: AiTaskState;
  objective: string;
  personaName: string;
  todos: AiTodo[];
  /** The latest plan revision, when the task carries one (Plan mode). */
  plan?: AiPlanDraft;
  /** A failure message from the latest run, when present. */
  failure?: string;
  updatedAt: string;
};

/** The whole dock state. Async: `status` tracks the chats load; `sending` is true
 *  while a turn is in flight; `activeTask` mirrors the polled task for the open chat. */
export type AiAgentState = {
  mode: AiMode;
  view: AiAgentView;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  chats: AiChat[];
  activeChatId: string | null;
  /** Turns of the active chat. */
  messages: AiMessage[];
  /** True while a turn POST is in flight. */
  sending: boolean;
  /** The task spawned by the active conversation (polled live), or null. */
  activeTask: AiTask | null;
  /** Context toggles. `document` pins the open resource (the only one that reaches
   *  the backend); selection / knowledge / sources are surfaced but badged as
   *  not-yet-applied (B2b). */
  contextSourceIds: AiContextSourceId[];
  excludedContextItemIds: string[];
  /** The per-turn live-web flag (a bar toggle). Effective only on Ask turns, and
   *  only when the server has a web retriever configured. */
  webEnabled: boolean;
  /** Selectable personas for the picker. Empty when the server has no persona
   *  capability, in which case the picker hides. */
  personas: AiPersona[];
  /** The dock's current persona selection: the open chat's persona, or — before a
   *  chat exists — the pending pick applied to the chat the next turn creates. */
  personaId: string | null;
  /** The requester's default persona (`/personas/default`), used to seed a new chat's
   *  picker and to detect when a pick differs from the default. */
  defaultPersonaId: string | null;
  /** The active chat's attachments (loaded when a chat opens; chat-scoped). */
  attachments: AiAttachment[];
  /** True when the server has no Files capability (attachment routes 404/501) — the
   *  dock then badges attachments unavailable instead of offering upload. */
  attachmentsUnavailable: boolean;
  /** The active resource tab's id/kind, for pinning a chat to the open document. */
  activeResourceId: string | null;
  activeResourceKind: string | null;
};
