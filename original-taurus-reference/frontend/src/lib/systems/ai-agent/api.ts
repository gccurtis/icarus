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

/** Set (or clear, with an empty id) a chat's persona. Returns the updated chat; the
 *  turn/task the chat spawns then runs under this persona. */
export async function setChatPersona(chatId: string, personaId: string): Promise<AiChat> {
  const res = await api<{ chat: OmegaChat }>(
    `/agent/chats/${encodeURIComponent(chatId)}/persona`,
    { method: 'PATCH', body: JSON.stringify({ personaId }) }
  );
  return toAiChat(res.chat);
}

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

// --- persona client ----------------------------------------------------------

// Omega wraps a persona as a `Record` = { persona, version }; the picker only
// needs the stable identity fields off `persona`.
type OmegaPersona = { id: string; name: string; description: string };
type OmegaPersonaRecord = { persona: OmegaPersona };

function toAiPersona(rec: OmegaPersonaRecord): AiPersona {
  return { id: rec.persona.id, name: rec.persona.name, description: rec.persona.description };
}

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

/** Remove a chat attachment (204 No Content). */
export async function deleteAttachment(chatId: string, attachmentId: string): Promise<void> {
  await api<void>(
    `/agent/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' }
  );
}
