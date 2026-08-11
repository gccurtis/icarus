# src/lib/systems/ai-agent/types.ts — breakdown

Companion to [types.ts](types.ts). The UI-facing type vocabulary for the AI Agent
dock, sitting over Omega's real chat + agent-task model. A dock conversation is an
Omega **chat** with ordered **turns**; an `action`/`plan` turn spawns a durable
**task** the client polls, and Plan tasks expose a reviewable draft. Every type here
is the dock's own shape — the raw Omega JSON is mapped into these in `api.ts` and
never reaches components directly.

## Module overview

### The file doc-comment that frames the whole model

```ts
/**
 * AI Agent dock — UI types over Omega's real chat + agent-task model.
 *
 * A dock conversation is an Omega **chat** (`/agent/chats`) with ordered **turns**
 * (`role: user | agent`). An `action`/`plan` turn spawns a durable **task** the
 * client polls (`/agent/tasks/:id`); the agent turn carries its `taskId`. Plan
 * tasks expose a reviewable draft the user can accept.
 */

```

The header states the domain vocabulary once so the rest of the file reads cleanly:
chat → turns → task, with the agent turn carrying a `taskId` that links a turn to the
durable task it spawned. The trailing blank line separates the doc-comment from the
first type.

## Conversation modes and views

### The three modes and the two dock panes

```ts
/** The three conversation modes (maps 1:1 to Omega chat `mode`). */
export type AiMode = 'ask' | 'action' | 'plan';

/** Which pane the dock shows. */
export type AiAgentView = 'chats' | 'conversation';

```

`AiMode` is the composer's mode selector and maps one-to-one onto Omega's chat
`mode`, so a chat's mode is fixed at creation. `AiAgentView` is a pure UI concern:
the panel either lists chats or shows one open conversation.

## Personas

### A selectable agent persona backing the picker

```ts
/** A selectable agent persona (Omega `Persona`). A chat carries a `personaId` set
 *  via `PATCH /agent/chats/:id/persona`; the dock's picker sets it **per chat**, and a
 *  spawned task inherits its chat's persona. An empty chat persona falls back to the
 *  requester's default (`/personas/default`). */
export type AiPersona = {
  id: string;
  name: string;
  description: string;
};

```

`AiPersona` is the flattened identity of an Omega persona. The dock's picker sets a
chat's `personaId` (`PATCH /agent/chats/:id/persona`); a spawned task inherits its
chat's persona, and an empty chat persona falls back to the requester's default.

## Context sources

### The context-toggle id set and the toggle descriptor

```ts
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

```

`AiContextSourceId` enumerates the four toggles the dock offers. Only `document`
truly reaches the backend today; the other three are surfaced for review but badged
not-yet-applied. `AiContextSource` is the descriptor the picker renders — its `wired`
flag is what drives that mock badge. Note the live-web flag is deliberately *not* a
context source; it is the separate per-turn `webEnabled` toggle on `AiAgentState`.

## Messages and chats

### One conversation turn and one chat summary

```ts
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

```

`AiMessage` is one rendered turn; its optional `taskId` is the hook the panel uses to
resume polling a task after re-opening a chat. `AiChat` is the lightweight summary the
recent-chats list renders — Omega's chat carries no preview or last-message text, so
the list shows title, mode badge, and relative time only. Its `personaId` is the chat's
selected persona (empty means the requester's default).

## Attachments

### One chat-scoped attachment

```ts
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

```

`AiAttachment` describes one uploaded file or directory bound to a chat. Attachments
are chat-scoped, so they only exist once a chat is open; Omega feeds a text attachment
(capped at 32KB) into the turn as extra context. `relativePath` is only populated for
members uploaded as part of a directory, preserving their folder position.

## Turn result

### The synchronous payload from posting a turn

```ts
/** The synchronous result of posting one turn. */
export type AiTurnResult = {
  userMessage: AiMessage;
  agentMessage: AiMessage;
  usage: { promptTokens: number; totalTokens: number };
};

```

Posting a turn returns both the echoed user message and the agent reply in one shot,
plus token usage. For Ask turns the `agentMessage` is the whole answer; for
Action/Plan turns it carries a `taskId` and the real work happens in the polled task.

## Task and to-do states

### Task lifecycle, to-do state, and a working-list item

```ts
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

```

`AiTaskState` is the full lifecycle the poll loop watches — the last four values are
terminal and stop polling. `AiTodoState` is the per-item state the task card renders
as a glyph. `AiTodo` is one row of the task's live working list.

## Plan drafts

### A plan step and the reviewable plan draft

```ts
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

```

Plan mode produces a draft the user reviews before it runs. `AiPlanDraft` mirrors the
*latest* Omega plan revision — its `revisionId` is what the Accept action targets, and
`accepted` (derived from the revision state) flips the card from a Draft badge to an
Accepted one.

## The spawned task

### The dock's view of one agent task

```ts
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

```

`AiTask` is the unified card model for both Action and Plan tasks: lifecycle `state`,
the human `objective`, the resolving `personaName`, and the live `todos` list. `plan`
is present only in Plan mode, and `failure` surfaces the latest run's error message
when one exists.

## The dock state

### The whole store shape

```ts
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
```

`AiAgentState` is the single writable store backing every dock surface. It braids
three async signals — `status` (chats load), `sending` (turn in flight), and
`activeTask` (the live-polled task) — with the conversation contents, the context
toggles (`contextSourceIds` plus per-item `excludedContextItemIds`), the persona
picker (`personas`/`personaId`), chat attachments and their capability flag, and the
`activeResourceId`/`activeResourceKind` pair used to pin a new chat to the open
document.
