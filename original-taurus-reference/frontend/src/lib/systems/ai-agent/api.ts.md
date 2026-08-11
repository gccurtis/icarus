# src/lib/systems/ai-agent/api.ts — breakdown

Companion to [api.ts](api.ts). The real Omega client for the AI Agent dock: chats,
turns, the tasks a turn spawns, the persona picker's client, and the chat-attachment
client. It replaces the old mock conversation store. Every exported function maps the
raw Omega JSON into a UI-friendly shape from `types.ts`, so the backend's wire format
never leaks past this module.

## Imports

### Import the base API client and the dock's UI types

```ts
import { api } from '$data/api';
import type {
  AiAttachment,
  AiChat,
  AiMessage,
  AiMode,
  AiPersona,
  AiPlanDraft,
  AiTask,
  AiTodo,
  AiTurnResult
} from './types';

```

`api` is the shared fetch wrapper from the data layer that talks to `/api/*`. The
type-only import pulls in every UI shape this module produces. The trailing blank line
separates imports from the module doc-comment.

## Module doc-comment

### Document the endpoints and the persona-resolution contract

```ts
/**
 * Real Omega client for the AI Agent dock — chats, turns, and the tasks a turn
 * spawns. Replaces the mock conversation store (Goal 3.3 / B2).
 *
 * - Chats: `GET/POST /agent/chats`, `GET /agent/chats/:id`, `POST …/turns`,
 *   `PATCH …/persona`.
 * - Tasks: `GET /agent/tasks/:id`, `POST /agent/tasks/:id/plans/:planId/accept`.
 *
 * Each chat carries a `personaId` (empty = the requester's default); the dock's
 * picker sets it per chat via `PATCH …/persona`, and a spawned task inherits it.
 * Every function returns a UI-friendly shape — the raw Omega JSON never leaves
 * this module.
 */

```

The header lists the chat and task endpoints this module wraps and states the key
contract: each chat carries a `personaId` the picker sets via `PATCH …/persona`, and a
spawned task inherits it. It closes with the module's invariant — callers only ever see
UI shapes.

## Raw Omega chat and turn shapes

### The wire types for chats, turns, and turn results

```ts
// --- raw Omega shapes (only the fields we read) ------------------------------

type OmegaChat = {
  id: string;
  title: string;
  mode: string;
  resourceId?: string;
  personaId?: string;
  updatedAt: string;
};

type OmegaTurn = {
  id: string;
  role: string;
  body: string;
  taskId?: string;
};

type OmegaTurnResult = {
  userTurn: OmegaTurn;
  agentTurn: OmegaTurn;
  usage?: { promptTokens?: number; totalTokens?: number };
};

```

These are deliberately partial wire types — only the fields the dock reads are typed,
so Omega can add fields without breaking the client. `OmegaChat` and `OmegaTurn` use
loose `string` for `mode`/`role` (narrowed in the mappers), and `OmegaTurnResult` pairs
the echoed user turn with the agent reply plus optional usage.

## Raw Omega plan and task shapes

### The wire types for plan revisions, to-dos, and tasks

```ts
type OmegaPlanStep = { id: string; title: string; description: string };
type OmegaPlanRevision = {
  id: string;
  state: string;
  acceptedAt?: string;
  draft?: { title?: string; summary?: string; steps?: OmegaPlanStep[] };
};
type OmegaTodo = { id: string; text: string; state: string; detail?: string };
type OmegaTask = {
  id: string;
  mode: string;
  state: string;
  objective: string;
  persona?: { name?: string };
  workspace?: { todos?: OmegaTodo[] };
  plans?: OmegaPlanRevision[];
  runs?: Array<{ failure?: string }>;
  updatedAt: string;
};

```

`OmegaTask` is the richest wire shape: it nests the resolving `persona`, the
`workspace.todos` working list, an array of `plans` (revisions), and `runs` whose
latest `failure` surfaces on the card. `OmegaPlanRevision.draft` is optional and deeply
partial because a task may not have produced a plan yet.

## Chat and message mappers

### Map a chat and a turn to their UI shapes

```ts
// --- mappers -----------------------------------------------------------------

export function toAiChat(o: OmegaChat): AiChat {
  return {
    id: o.id,
    title: o.title || 'Untitled chat',
    mode: (o.mode as AiMode) ?? 'ask',
    resourceId: o.resourceId || undefined,
    personaId: o.personaId || undefined,
    updatedAt: o.updatedAt
  };
}

export function toAiMessage(t: OmegaTurn): AiMessage {
  return {
    id: t.id,
    author: t.role === 'agent' ? 'agent' : 'user',
    body: t.body,
    taskId: t.taskId || undefined
  };
}

```

`toAiChat` supplies an "Untitled chat" fallback, narrows the loose `mode` to `AiMode`
(defaulting to `ask`), and normalizes empty strings to `undefined` (including the chat's
`personaId`, empty when it uses the requester's default). `toAiMessage` collapses Omega's
`role` into the dock's two-value `author` (anything not `agent` is treated as the user)
and carries the optional `taskId` link.

## Plan mapper

### Fold the latest plan revision into a reviewable draft

```ts
function toAiPlan(revisions: OmegaPlanRevision[] | undefined): AiPlanDraft | undefined {
  const pr = revisions?.[revisions.length - 1];
  if (!pr) return undefined;
  return {
    revisionId: pr.id,
    title: pr.draft?.title ?? 'Plan',
    summary: pr.draft?.summary ?? '',
    steps: (pr.draft?.steps ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description
    })),
    state: pr.state,
    accepted: !!pr.acceptedAt || pr.state === 'accepted'
  };
}

```

`toAiPlan` takes only the *last* revision (the current draft) and returns `undefined`
when there is none. It fills title/summary/steps defaults so the card never renders
holes, and computes `accepted` from either an `acceptedAt` timestamp or an `accepted`
state — Omega may signal acceptance either way.

## Task mapper

### Map an Omega task to the dock's task card model

```ts
export function toAiTask(o: OmegaTask): AiTask {
  const failure = o.runs?.[o.runs.length - 1]?.failure;
  return {
    id: o.id,
    mode: o.mode === 'plan' ? 'plan' : 'action',
    state: (o.state as AiTask['state']) ?? 'queued',
    objective: o.objective,
    personaName: o.persona?.name || 'Agent',
    todos: (o.workspace?.todos ?? []).map(
      (t): AiTodo => ({ id: t.id, text: t.text, state: (t.state as AiTodo['state']) ?? 'open', detail: t.detail || undefined })
    ),
    plan: toAiPlan(o.plans),
    failure: failure || undefined,
    updatedAt: o.updatedAt
  };
}

```

`toAiTask` pulls the latest run's `failure`, narrows `mode` to plan/action and `state`
to the task-state union (defaulting `queued`), names an unnamed persona "Agent", maps
each workspace to-do (defaulting `open` state), and folds any plan revisions through
`toAiPlan`. This is the one function that assembles the whole task card.

## Chat client — list, create, fetch

### List, open, and fetch chats

```ts
// --- chat client -------------------------------------------------------------

/** List the project's chats (most-recent first), optionally pinned to one resource. */
export async function listChats(resourceId?: string): Promise<AiChat[]> {
  const query = resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : '';
  const res = await api<{ chats: OmegaChat[] }>(`/agent/chats${query}`);
  return (res.chats ?? []).map(toAiChat);
}

/** Open a new chat in the given mode, optionally pinned to the active resource. */
export async function createChat(mode: AiMode, resourceId?: string, title = ''): Promise<AiChat> {
  const chat = await api<OmegaChat>('/agent/chats', {
    method: 'POST',
    body: JSON.stringify({ mode, resourceId: resourceId ?? '', title })
  });
  return toAiChat(chat);
}

/** Fetch one chat and its ordered turns. */
export async function getChat(chatId: string): Promise<{ chat: AiChat; messages: AiMessage[] }> {
  const res = await api<{ chat: OmegaChat; turns: OmegaTurn[] }>(
    `/agent/chats/${encodeURIComponent(chatId)}`
  );
  return { chat: toAiChat(res.chat), messages: (res.turns ?? []).map(toAiMessage) };
}

```

`listChats` GETs `/agent/chats`, optionally filtered to one resource, and maps each
summary. `createChat` POSTs a mode + optional resource pin + title, fixing the chat's
mode at creation. `getChat` fetches one chat plus its ordered turns and returns both the
chat summary and the mapped messages.

## Chat client — posting a turn

### Post a user turn and unpack the synchronous reply

```ts
/** Post a user turn; the agent reply returns synchronously (ask) or carries a
 *  `taskId` to poll (action/plan). `web` asks an ask turn to consult the live web. */
export async function postTurn(chatId: string, message: string, web: boolean): Promise<AiTurnResult> {
  const res = await api<OmegaTurnResult>(`/agent/chats/${encodeURIComponent(chatId)}/turns`, {
    method: 'POST',
    body: JSON.stringify({ message, web })
  });
  return {
    userMessage: toAiMessage(res.userTurn),
    agentMessage: toAiMessage(res.agentTurn),
    usage: {
      promptTokens: res.usage?.promptTokens ?? 0,
      totalTokens: res.usage?.totalTokens ?? 0
    }
  };
}

```

`postTurn` sends the user's message and the per-turn `web` flag, then maps both turns
back to UI messages and normalizes usage counts to zero when absent. For Ask the reply
is the whole answer; for Action/Plan the agent turn carries a `taskId` the caller then
polls.

## Chat client — persona

### Set a chat's persona

```ts
/** Set (or clear, with an empty id) a chat's persona. Returns the updated chat; the
 *  turn/task the chat spawns then runs under this persona. */
export async function setChatPersona(chatId: string, personaId: string): Promise<AiChat> {
  const res = await api<{ chat: OmegaChat }>(
    `/agent/chats/${encodeURIComponent(chatId)}/persona`,
    { method: 'PATCH', body: JSON.stringify({ personaId }) }
  );
  return toAiChat(res.chat);
}

```

`setChatPersona` PATCHes the chat's persona route with the chosen id (empty clears it,
falling back to the requester's default). It maps the returned chat to `AiChat` — the
turn (and any task) the chat next spawns runs under this persona.

## Task client

### Fetch a task's live state and accept a plan

```ts
// --- task client -------------------------------------------------------------

/** Fetch one agent task's live state, working list, and plan draft. */
export async function getTask(taskId: string): Promise<AiTask> {
  const task = await api<OmegaTask>(`/agent/tasks/${encodeURIComponent(taskId)}`);
  return toAiTask(task);
}

/** Accept a plan revision on a task; returns the updated task. */
export async function acceptPlan(taskId: string, planId: string): Promise<AiTask> {
  const task = await api<OmegaTask>(
    `/agent/tasks/${encodeURIComponent(taskId)}/plans/${encodeURIComponent(planId)}/accept`,
    { method: 'POST' }
  );
  return toAiTask(task);
}

```

`getTask` is the poll endpoint — one GET returning the full mapped task. `acceptPlan`
POSTs to the plan-accept route for a specific revision and returns the updated task, so
the caller can immediately re-render and resume polling the now-running task.

## Persona client — shapes and mapper

### The wrapped persona record and its flattening mapper

```ts
// --- persona client ----------------------------------------------------------

// Omega wraps a persona as a `Record` = { persona, version }; the picker only
// needs the stable identity fields off `persona`.
type OmegaPersona = { id: string; name: string; description: string };
type OmegaPersonaRecord = { persona: OmegaPersona };

function toAiPersona(rec: OmegaPersonaRecord): AiPersona {
  return { id: rec.persona.id, name: rec.persona.name, description: rec.persona.description };
}

```

Omega returns a persona wrapped in a versioned `Record`. `toAiPersona` unwraps the
stable identity fields the picker actually needs — id, name, description — and discards
the version envelope.

## Persona client — list and default get/set

### List personas and read/write the requester's default

```ts
/** List the project's personas (Omega always includes the managed **General**). */
export async function listPersonas(): Promise<AiPersona[]> {
  const res = await api<{ personas: OmegaPersonaRecord[] }>('/personas');
  return (res.personas ?? []).map(toAiPersona);
}

/** The requester's current default persona for this project (General if unset). */
export async function getDefaultPersona(): Promise<AiPersona> {
  return toAiPersona(await api<OmegaPersonaRecord>('/personas/default'));
}

/** Set the requester's default persona; Omega resolves it for subsequent turns. */
export async function setDefaultPersona(personaId: string): Promise<AiPersona> {
  const rec = await api<OmegaPersonaRecord>('/personas/default', {
    method: 'PUT',
    body: JSON.stringify({ personaId })
  });
  return toAiPersona(rec);
}

```

`listPersonas` GETs the project's personas (Omega always includes a managed General).
`getDefaultPersona` reads the requester's current default, and `setDefaultPersona` PUTs
a new one — Omega then applies that default to every subsequent turn, which is why the
picker mutates a default rather than a per-chat field.

## Attachment client — shapes and mapper

### The upload payload, the wire attachment, and its mapper

```ts
// --- attachment client -------------------------------------------------------

// One uploaded file's base64 payload. `relativePath` is set for directory members.
export type FileUpload = {
  name: string;
  contentType: string;
  content: string; // base64
  relativePath?: string;
};

type OmegaAttachment = { id: string; name: string; kind: string; relativePath?: string };

function toAiAttachment(a: OmegaAttachment): AiAttachment {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind === 'directory' ? 'directory' : 'file',
    relativePath: a.relativePath || undefined
  };
}

```

`FileUpload` is the exported base64 payload shape the actions layer builds when reading
a picked file. `OmegaAttachment` is the wire attachment, and `toAiAttachment` narrows
its loose `kind` to file/directory and normalizes an empty `relativePath` to
`undefined`.

## Attachment client — list and upload

### List a chat's attachments and upload files or a directory

```ts
/** List a chat's attachments (creation order). 404/501 when Files is unconfigured. */
export async function listAttachments(chatId: string): Promise<AiAttachment[]> {
  const res = await api<{ attachments: OmegaAttachment[] }>(
    `/agent/chats/${encodeURIComponent(chatId)}/attachments`
  );
  return (res.attachments ?? []).map(toAiAttachment);
}

/** Upload one file (base64 body at the top level); returns the stored attachment. */
export async function addFileAttachment(
  chatId: string,
  file: { name: string; contentType: string; content: string }
): Promise<AiAttachment> {
  const a = await api<OmegaAttachment>(`/agent/chats/${encodeURIComponent(chatId)}/attachments`, {
    method: 'POST',
    body: JSON.stringify(file)
  });
  return toAiAttachment(a);
}

/** Upload a directory of files (each base64, under `directory`); returns them all. */
export async function addDirectoryAttachment(
  chatId: string,
  files: FileUpload[]
): Promise<AiAttachment[]> {
  const res = await api<{ attachments: OmegaAttachment[] }>(
    `/agent/chats/${encodeURIComponent(chatId)}/attachments`,
    { method: 'POST', body: JSON.stringify({ directory: files }) }
  );
  return (res.attachments ?? []).map(toAiAttachment);
}

```

`listAttachments` GETs a chat's attachments — a 404/501 here is the signal the server
has no Files capability, which the actions layer catches. `addFileAttachment` POSTs one
file's base64 body at the top level; `addDirectoryAttachment` POSTs many files nested
under a `directory` key, and both return the mapped stored attachments.

## Attachment client — delete

### Remove one attachment

```ts
/** Remove a chat attachment (204 No Content). */
export async function deleteAttachment(chatId: string, attachmentId: string): Promise<void> {
  await api<void>(
    `/agent/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' }
  );
}
```

`deleteAttachment` DELETEs one attachment and resolves to `void` — Omega replies 204 No
Content, so there is no body to map. The actions layer wraps this optimistically,
reverting the local list if the request fails.
