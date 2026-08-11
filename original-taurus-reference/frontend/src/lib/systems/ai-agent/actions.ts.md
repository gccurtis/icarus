# src/lib/systems/ai-agent/actions.ts — breakdown

Companion to [actions.ts](actions.ts). The async action layer that drives the
`aiAgent` store against the real Omega client: navigation, the Ask-only web toggle,
context toggles, loading and opening chats, sending turns (optimistic user turn → real
reply), live task polling and plan accept, loading and switching the requester's
default persona, and uploading / listing / removing chat attachments. Every mutation
funnels through the store's `update`, and every network call is guarded so a stale
response for a chat the user has left is discarded.

## Imports

### Store access, toast, the API-error guard, types, and the client

```ts
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

```

`get` reads the store synchronously inside actions (to snapshot or re-check state
after an await). `toast` surfaces failures, `isApiError` narrows caught errors, and the
long block imports every client function from `api.ts`. The trailing blank line
separates imports from the module helpers.

## Terminal-state and error helpers

### Small predicates for polling, error text, and capability detection

```ts
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TERMINAL: AiTaskState[] = ['completed', 'partially_completed', 'failed', 'canceled'];
const isTerminal = (s: AiTaskState) => TERMINAL.includes(s);
const errorText = (e: unknown, fallback: string) => (isApiError(e) ? e.message : fallback);
// A 404/501 from an attachment route means the server has no Files capability.
const isUnavailable = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 501);

```

`sleep` is the poll delay. `TERMINAL`/`isTerminal` classify the four task states that
stop polling. `errorText` unwraps an `ApiError`'s message (or falls back to a friendly
string), and `isUnavailable` recognizes the 404/501 that means the server has no Files
capability — used to degrade attachments to a badge rather than an error.

## Reading a file as base64

### Turn a picked browser File into a base64 payload

```ts
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

```

`readFileBase64` wraps `FileReader` in a promise and reads the file as a data URL, then
strips everything up to and including the first comma — leaving just the base64 payload
Omega's attachment routes expect. It rejects on read error.

## Optimistic ids and title derivation

### Mint local message ids and derive a chat title from the first prompt

```ts
// Optimistic-message ids (local, replaced by server turns on success).
let localSeq = 0;
const nextLocalId = () => `local-${++localSeq}`;

function titleFrom(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  return clean.length > 60 ? `${clean.slice(0, 60).trimEnd()}…` : clean;
}

```

`nextLocalId` mints monotonically increasing `local-N` ids for optimistic user messages
that are replaced by real server turns on success. `titleFrom` collapses whitespace and
truncates to 60 characters (with an ellipsis) to name a new chat after its opening
prompt.

## Mode and web toggles

### Set the composer mode and toggle the Ask-only live-web flag

```ts
// --- composer / navigation ---------------------------------------------------

export function setAiMode(mode: AiMode) {
  aiAgent.update((s) => ({ ...s, mode }));
}

/** Toggle the per-turn live-web flag. Effective only on Ask turns (Omega ignores
 *  it for Plan/Action), and only when the server has a web retriever configured. */
export function setWebEnabled(on: boolean) {
  aiAgent.update((s) => ({ ...s, webEnabled: on }));
}

```

`setAiMode` writes the composer's current mode. `setWebEnabled` flips the per-turn
live-web flag — which `submitAiPrompt` only forwards for Ask turns, since Omega ignores
it for Plan/Action and it only matters when a web retriever is configured.

## Navigation and resource tracking

### Return to the chats list and track the active resource tab

```ts
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

```

`showAiChats` returns to the list pane and clears the open conversation, its task, and
attachments, resetting the persona picker to the default. `setActiveResource` records the active resource tab's id/kind so a new
chat can pin to the open document — it returns the same state object unchanged when
nothing moved, avoiding a needless store notification.

## Context source toggles

### Toggle a whole source, and exclude a single context item

```ts
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

```

`toggleAiContextSource` flips a source on or off; when re-enabling, it also clears any
per-item exclusions that belonged to that source (matched by the `id:` prefix), so a
re-enabled source comes back whole. `excludeAiContextItem` adds one item id to the
exclusion set (idempotently), hiding a single item without disabling its source.

## Loading chats

### Load the project's chats into the list

```ts
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

```

`loadChats` shows a loading status only on the first load (when the list is empty),
then replaces the list and marks `ready`, or records an error message. It deliberately
leaves any open conversation intact, so refreshing the list never disrupts an active
chat.

## Opening a chat

### Open a chat, show its turns, and resume any spawned task

```ts
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

```

`selectAiChat` switches to the conversation pane immediately (adopting the chat's fixed
mode and persona), then fetches its turns. The `activeChatId` re-check after the await
discards a stale response if the user has since navigated away. On success it reconciles
the chat in the list with the fresh copy, sets the picker to the chat's persona, loads
attachments, and scans the turns newest-first for a `taskId` to resume polling.

## Submitting a prompt

### Send a prompt, reusing or opening a chat, with an optimistic user turn

```ts
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

```

`submitAiPrompt` is the core send path. It ignores empty prompts and re-entrant sends,
reuses the open chat only when its mode matches (Omega fixes a chat's mode at creation),
and shows the user's turn optimistically. It creates a chat when needed — pinning the
open resource only if the `document` toggle is on, and applying the composer's pending
persona to the new chat (a non-default pick is PATCHed before the turn) — then posts the
turn (forwarding `web` for Ask only). On success it swaps the optimistic turn for the real server turns
and starts polling any spawned task; on failure it rolls the optimistic turn back and
toasts. Each `activeChatId` re-check guards against a response arriving after the user
moved on.

## Task polling

### Poll one task to a terminal state, newest poll wins

```ts
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

```

`trackTask` runs a bounded poll loop (240 rounds at 1.5s ≈ six minutes). A module-level
`pollToken` guarantees only the newest loop wins: an older loop notices its token was
superseded and returns. It also stops when the user leaves the chat (the `activeChatId`
guard), writes each fresh task snapshot to the store, and exits on a terminal state.
Transient read errors are swallowed so one blip doesn't kill the loop.

## Accepting a plan

### Accept the active plan draft and resume polling

```ts
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

```

`acceptAiPlan` accepts the active task's current plan revision. It no-ops when there is
no task, no plan, or the plan is already accepted, and when an optional `taskId`
argument doesn't match the active task. On success it stores the updated task, toasts,
and resumes polling the now-running task.

## Loading personas

### Load personas and the current default, silent on failure

```ts
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

```

`loadPersonas` fetches the persona list and the requester's current default in parallel,
recording the default and seeding the picker with it (unless a chat is already open, whose
persona selection it leaves intact). Because the dock mounts before the project session
finishes selecting, the first attempt can race and fail, so it retries a few times with a
short backoff before giving up — at which point the picker clears and hides (a server with
no persona capability 404s these routes and reaches that state after the retries).

## Switching persona

### Set the open chat's persona optimistically (pending before a chat exists)

```ts
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

```

`setAiPersona` updates the picker optimistically and no-ops when the selection is
unchanged. With a chat open it PATCHes that chat's persona (reconciling the returned chat
into the list) and reverts + toasts on failure. With no chat open the pick is simply held
as pending — `submitAiPrompt` applies it to the chat the next turn creates.

## Attachment error handling

### Flip the unavailable badge or toast a plain error

```ts
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

```

`handleAttachError` is the shared error path for the upload actions: a 404/501 means the
server lacks the Files capability, so it flips the `attachmentsUnavailable` badge and
shows an attention toast; any other error becomes a plain danger toast with the given
fallback text.

## Loading attachments

### Load the active chat's attachments, detecting capability absence

```ts
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

```

`loadAttachments` fetches a chat's attachments when it opens and, on success, clears the
unavailable badge (guarding against a stale response for a chat the user left). A
404/501 flips the badge and empties the list; other transient read errors are ignored so
the existing list stays put.

## Attaching files

### Upload picked files one at a time to the active chat

```ts
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

```

`attachFiles` requires an open chat (attachments are chat-scoped) and uploads each file
individually, appending it to the list as it lands — so a later failure keeps the
earlier successes. Each iteration re-checks `activeChatId` so uploads stop if the user
leaves, and defaults an unknown MIME type to `application/octet-stream`.

## Attaching a folder

### Upload a picked folder as one directory attachment

```ts
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

```

`attachFolder` reads every picked file to base64 in parallel (preserving each file's
`webkitRelativePath` as its folder position) and uploads them as one directory
attachment. It requires an open chat and a non-empty selection, special-cases a 413 as a
too-many-files message, and otherwise defers to `handleAttachError`.

## Removing an attachment

### Optimistically remove an attachment, reverting on failure

```ts
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
```

`removeAttachment` drops the attachment from the list immediately, snapshotting the
prior list first. If the DELETE fails it restores that snapshot — but only if the user
is still on the same chat — and toasts, so an optimistic removal never leaves the list
wrong for the current chat.
