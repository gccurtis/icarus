import { get } from 'svelte/store';
import { toast } from '$lib/components';
import { isApiError } from '$data/api';
import type { AiContextSourceId, AiMessage, AiMode, AiTaskState } from './types';
import { aiAgent } from './store';
import {
  acceptPlan,
  addDirectoryAttachment,
  addFileAttachment,
  createChat,
  deleteAttachment,
  getChat,
  getDefaultPersona,
  getTask,
  listAttachments,
  listChats,
  listPersonas,
  postTurn,
  setChatPersona
} from './api';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TERMINAL: AiTaskState[] = ['completed', 'partially_completed', 'failed', 'canceled'];
const isTerminal = (s: AiTaskState) => TERMINAL.includes(s);
const errorText = (e: unknown, fallback: string) => (isApiError(e) ? e.message : fallback);
// A 404/501 from an attachment route means the server has no Files capability.
const isUnavailable = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 501);

/** Read a browser File as base64 (strips the `data:...;base64,` prefix). */
function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

// Optimistic-message ids (local, replaced by server turns on success).
let localSeq = 0;
const nextLocalId = () => `local-${++localSeq}`;

function titleFrom(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  return clean.length > 60 ? `${clean.slice(0, 60).trimEnd()}…` : clean;
}

// --- composer / navigation ---------------------------------------------------

export function setAiMode(mode: AiMode) {
  aiAgent.update((s) => ({ ...s, mode }));
}

/** Toggle the per-turn live-web flag. Effective only on Ask turns (Omega ignores
 *  it for Plan/Action), and only when the server has a web retriever configured. */
export function setWebEnabled(on: boolean) {
  aiAgent.update((s) => ({ ...s, webEnabled: on }));
}

export function showAiChats() {
  aiAgent.update((s) => ({
    ...s,
    view: 'chats',
    activeChatId: null,
    messages: [],
    activeTask: null,
    attachments: [],
    personaId: s.defaultPersonaId
  }));
}

/** Track the active resource tab so new chats pin to the open document. */
export function setActiveResource(resourceId: string | null, resourceKind: string | null) {
  aiAgent.update((s) =>
    s.activeResourceId === resourceId && s.activeResourceKind === resourceKind
      ? s
      : { ...s, activeResourceId: resourceId, activeResourceKind: resourceKind }
  );
}

export function toggleAiContextSource(id: string) {
  aiAgent.update((state) => {
    const enabled = state.contextSourceIds.includes(id as AiContextSourceId);
    return {
      ...state,
      contextSourceIds: enabled
        ? state.contextSourceIds.filter((sourceId) => sourceId !== id)
        : [...state.contextSourceIds, id as AiContextSourceId],
      excludedContextItemIds: enabled
        ? state.excludedContextItemIds
        : state.excludedContextItemIds.filter((itemId) => !itemId.startsWith(`${id}:`))
    };
  });
}

export function excludeAiContextItem(id: string) {
  aiAgent.update((state) => ({
    ...state,
    excludedContextItemIds: state.excludedContextItemIds.includes(id)
      ? state.excludedContextItemIds
      : [...state.excludedContextItemIds, id]
  }));
}

// --- chats -------------------------------------------------------------------

/** Load the project's chats into the list (leaves any open conversation intact). */
export async function loadChats() {
  aiAgent.update((s) => ({ ...s, status: s.chats.length ? s.status : 'loading', error: null }));
  try {
    const chats = await listChats();
    aiAgent.update((s) => ({ ...s, chats, status: 'ready' }));
  } catch (e) {
    aiAgent.update((s) => ({ ...s, status: 'error', error: errorText(e, 'Could not load chats') }));
  }
}

/** Open a chat: show its turns and resume polling any task it spawned. */
export async function selectAiChat(id: string) {
  const chat = get(aiAgent).chats.find((c) => c.id === id);
  aiAgent.update((s) => ({
    ...s,
    view: 'conversation',
    activeChatId: id,
    messages: [],
    activeTask: null,
    attachments: [],
    mode: chat?.mode ?? s.mode,
    personaId: chat?.personaId ?? s.defaultPersonaId
  }));
  try {
    const { chat: fresh, messages } = await getChat(id);
    if (get(aiAgent).activeChatId !== id) return;
    aiAgent.update((s) => ({
      ...s,
      messages,
      personaId: fresh.personaId ?? s.defaultPersonaId,
      chats: s.chats.map((c) => (c.id === id ? fresh : c))
    }));
    void loadAttachments(id);
    const taskId = [...messages].reverse().find((m) => m.taskId)?.taskId;
    if (taskId) void trackTask(id, taskId);
  } catch (e) {
    toast(errorText(e, 'Could not open the chat'), { tone: 'danger' });
  }
}

/**
 * Send a prompt. Reuses the open chat when its mode matches; otherwise opens a
 * fresh chat in the composer's mode (Omega fixes a chat's mode at creation, so a
 * mode switch starts new work). The user turn is optimistic; the server turns
 * (and any spawned task) replace it on success.
 */
export async function submitAiPrompt(prompt: string, mode: AiMode) {
  const clean = prompt.trim();
  if (!clean) return;
  const s0 = get(aiAgent);
  if (s0.sending) return;

  const active = s0.chats.find((c) => c.id === s0.activeChatId);
  const reuseId = active && active.mode === mode ? active.id : null;
  const optimistic: AiMessage = { id: nextLocalId(), author: 'user', body: clean };

  aiAgent.update((s) => ({
    ...s,
    mode,
    view: 'conversation',
    sending: true,
    activeChatId: reuseId,
    messages: reuseId ? [...s.messages, optimistic] : [optimistic],
    activeTask: reuseId ? s.activeTask : null,
    attachments: reuseId ? s.attachments : []
  }));

  try {
    let chatId = reuseId;
    if (!chatId) {
      // The `document` toggle gates whether the new chat pins the open resource.
      const pin = s0.contextSourceIds.includes('document');
      const resourceId = pin ? (s0.activeResourceId ?? undefined) : undefined;
      const chat = await createChat(mode, resourceId, titleFrom(clean));
      chatId = chat.id;
      aiAgent.update((s) => ({
        ...s,
        activeChatId: chat.id,
        chats: [chat, ...s.chats.filter((c) => c.id !== chat.id)]
      }));
      // Apply the composer's pending persona to the new chat (the default needs no PATCH).
      if (s0.personaId && s0.personaId !== s0.defaultPersonaId) {
        const withPersona = await setChatPersona(chat.id, s0.personaId);
        aiAgent.update((s) => ({
          ...s,
          chats: s.chats.map((c) => (c.id === withPersona.id ? withPersona : c))
        }));
      }
    }
    // Live web is an Ask-only capability; never send the flag for Plan/Action.
    const web = get(aiAgent).webEnabled && mode === 'ask';
    const result = await postTurn(chatId, clean, web);
    if (get(aiAgent).activeChatId !== chatId) {
      aiAgent.update((s) => ({ ...s, sending: false }));
      return;
    }
    aiAgent.update((s) => ({
      ...s,
      sending: false,
      messages: [
        ...s.messages.filter((m) => m.id !== optimistic.id),
        result.userMessage,
        result.agentMessage
      ]
    }));
    if (result.agentMessage.taskId) void trackTask(chatId, result.agentMessage.taskId);
  } catch (e) {
    aiAgent.update((s) => ({
      ...s,
      sending: false,
      messages: s.messages.filter((m) => m.id !== optimistic.id)
    }));
    toast(errorText(e, 'Could not reach the agent'), { tone: 'danger' });
  }
}

// --- tasks -------------------------------------------------------------------

// One poll loop at a time wins: a newer task supersedes the token so a stale
// loop stops updating. Also stops when the user leaves the chat (or project).
let pollToken = 0;
async function trackTask(chatId: string, taskId: string) {
  const token = ++pollToken;
  for (let i = 0; i < 240; i++) {
    if (token !== pollToken || get(aiAgent).activeChatId !== chatId) return;
    try {
      const task = await getTask(taskId);
      if (token !== pollToken || get(aiAgent).activeChatId !== chatId) return;
      aiAgent.update((s) => ({ ...s, activeTask: task }));
      if (isTerminal(task.state)) return;
    } catch {
      // Transient read error — keep polling a bounded number of rounds.
    }
    await sleep(1500);
  }
}

/** Accept the active task's plan draft, then resume polling its run. */
export async function acceptAiPlan(taskId?: string) {
  const s = get(aiAgent);
  const task = s.activeTask;
  if (!task || !task.plan || task.plan.accepted) return;
  if (taskId && taskId !== task.id) return;
  try {
    const updated = await acceptPlan(task.id, task.plan.revisionId);
    aiAgent.update((st) => ({ ...st, activeTask: updated }));
    toast('Plan accepted — the agent is running it.', { tone: 'success' });
    if (s.activeChatId) void trackTask(s.activeChatId, task.id);
  } catch (e) {
    toast(errorText(e, 'Could not accept the plan'), { tone: 'danger' });
  }
}

// --- personas ----------------------------------------------------------------

/**
 * Load the project's personas + the requester's current default into the picker.
 * Silent on failure: a server without the persona capability 404s these routes,
 * and the picker simply hides (the server still applies its own default persona).
 */
export async function loadPersonas() {
  // The dock mounts before the project session finishes selecting, so the first load
  // can race and fail; retry a few times before giving up (then the picker hides).
  for (let attempt = 0; ; attempt++) {
    try {
      const [personas, current] = await Promise.all([listPersonas(), getDefaultPersona()]);
      // Seed the default; keep an already-open chat's persona selection intact.
      aiAgent.update((s) => ({
        ...s,
        personas,
        defaultPersonaId: current.id,
        // Seed the picker with the default only when nothing is selected yet; never
        // clobber an open chat's persona or a pending pre-send pick.
        personaId: s.personaId ?? current.id
      }));
      return;
    } catch {
      if (attempt < 3) {
        await sleep(400);
        continue;
      }
      aiAgent.update((s) => ({ ...s, personas: [], personaId: null, defaultPersonaId: null }));
      return;
    }
  }
}

/**
 * Set the persona for the open chat (optimistic; reverts on failure) via PATCH. With
 * no chat open yet, the pick is held as pending and `submitAiPrompt` applies it to the
 * chat the next turn creates. A spawned task inherits its chat's persona.
 */
export async function setAiPersona(personaId: string) {
  const s0 = get(aiAgent);
  const prev = s0.personaId;
  if (personaId === prev) return;
  // Optimistic: reflect the pick immediately.
  aiAgent.update((s) => ({ ...s, personaId }));
  // With no open chat the pick is pending — submitAiPrompt applies it to the chat it
  // creates. With a chat open, persist it now via PATCH.
  const chatId = s0.activeChatId;
  if (!chatId) return;
  try {
    const updated = await setChatPersona(chatId, personaId);
    aiAgent.update((s) => ({
      ...s,
      personaId: updated.personaId ?? s.defaultPersonaId,
      chats: s.chats.map((c) => (c.id === updated.id ? updated : c))
    }));
  } catch (e) {
    aiAgent.update((s) => ({ ...s, personaId: prev }));
    toast(errorText(e, 'Could not switch persona'), { tone: 'danger' });
  }
}

// --- attachments -------------------------------------------------------------

// A missing Files capability flips the badge; anything else is a plain error toast.
function handleAttachError(e: unknown, fallback: string) {
  if (isUnavailable(e)) {
    aiAgent.update((s) => ({ ...s, attachmentsUnavailable: true }));
    toast('Attachments aren’t enabled on this server.', { tone: 'attention' });
  } else {
    toast(errorText(e, fallback), { tone: 'danger' });
  }
}

/**
 * Load the active chat's attachments (called when a chat opens). Flags the
 * capability unavailable when the server has no Files support (routes 404/501);
 * other transient read errors leave the list as-is.
 */
export async function loadAttachments(chatId: string) {
  try {
    const attachments = await listAttachments(chatId);
    if (get(aiAgent).activeChatId !== chatId) return;
    aiAgent.update((s) => ({ ...s, attachments, attachmentsUnavailable: false }));
  } catch (e) {
    if (isUnavailable(e) && get(aiAgent).activeChatId === chatId) {
      aiAgent.update((s) => ({ ...s, attachments: [], attachmentsUnavailable: true }));
    }
  }
}

/**
 * Upload one or more files to the active chat. Attachments are chat-scoped in
 * Omega, so a chat must be open; each file is uploaded on its own so a later
 * failure keeps the earlier successes.
 */
export async function attachFiles(files: FileList | File[]) {
  const chatId = get(aiAgent).activeChatId;
  if (!chatId) {
    toast('Start a chat before attaching files.', { tone: 'attention' });
    return;
  }
  try {
    for (const file of Array.from(files)) {
      const content = await readFileBase64(file);
      if (get(aiAgent).activeChatId !== chatId) return;
      const attachment = await addFileAttachment(chatId, {
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        content
      });
      aiAgent.update((s) =>
        s.activeChatId === chatId ? { ...s, attachments: [...s.attachments, attachment] } : s
      );
    }
  } catch (e) {
    handleAttachError(e, 'Could not attach the file');
  }
}

/** Upload a picked folder to the active chat as one directory attachment. */
export async function attachFolder(files: FileList | File[]) {
  const chatId = get(aiAgent).activeChatId;
  if (!chatId) {
    toast('Start a chat before attaching files.', { tone: 'attention' });
    return;
  }
  const list = Array.from(files);
  if (!list.length) return;
  try {
    const payload = await Promise.all(
      list.map(async (file) => ({
        relativePath: file.webkitRelativePath || file.name,
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        content: await readFileBase64(file)
      }))
    );
    if (get(aiAgent).activeChatId !== chatId) return;
    const attachments = await addDirectoryAttachment(chatId, payload);
    aiAgent.update((s) =>
      s.activeChatId === chatId ? { ...s, attachments: [...s.attachments, ...attachments] } : s
    );
  } catch (e) {
    if (isApiError(e) && e.status === 413) {
      toast('That folder has too many files to attach.', { tone: 'danger' });
    } else {
      handleAttachError(e, 'Could not attach the folder');
    }
  }
}

/** Remove an attachment from the active chat (optimistic; reverts on failure). */
export async function removeAttachment(attachmentId: string) {
  const chatId = get(aiAgent).activeChatId;
  if (!chatId) return;
  const prev = get(aiAgent).attachments;
  aiAgent.update((s) => ({ ...s, attachments: s.attachments.filter((a) => a.id !== attachmentId) }));
  try {
    await deleteAttachment(chatId, attachmentId);
  } catch (e) {
    aiAgent.update((s) => (s.activeChatId === chatId ? { ...s, attachments: prev } : s));
    toast(errorText(e, 'Could not remove the attachment'), { tone: 'danger' });
  }
}
