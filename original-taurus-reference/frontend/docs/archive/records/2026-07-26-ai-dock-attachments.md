# 2026-07-26 — AI dock B2b-2: real chat attachments

Completes **B2b** (finishing the AI Agent dock). B2b-1 added the persona picker, the
Ask-only web toggle, and honest context badging; this slice un-mocks the last piece —
the File/Folder upload buttons — against Omega's real chat-attachment routes. The dock
now uploads, lists, and removes real attachments, degrading to a badge where the server
has no Files capability.

Contract confirmed against Omega source (`core/handlers/chat/attachment.go`,
`core/capability/chat/attachment.go`, `core/transport/transport.go`): attachments are
**chat-scoped**, uploaded as base64, and gated on `opts.Files` (routes 404 when the
capability is absent; handlers otherwise return 501). A turn picks up its chat's
attachments as context server-side — there is no per-turn attachment field.

## Attachment client — list, single-file, directory, delete

```ts
// systems/ai-agent/api.ts — single file at the top level; a directory under `directory`.
export async function addFileAttachment(chatId, file) {            // { name, contentType, content(base64) }
  const a = await api(`/agent/chats/${encodeURIComponent(chatId)}/attachments`,
    { method: 'POST', body: JSON.stringify(file) });
  return toAiAttachment(a);                                        // 201 → the Attachment directly
}
export async function addDirectoryAttachment(chatId, files) {      // FileUpload[] with relativePath
  const res = await api(`/agent/chats/${encodeURIComponent(chatId)}/attachments`,
    { method: 'POST', body: JSON.stringify({ directory: files }) });
  return (res.attachments ?? []).map(toAiAttachment);              // 201 → { attachments: [...] }
}
```

The single-file POST returns the stored `Attachment` object directly while the directory
POST returns `{ attachments }` — the client mirrors that split exactly. `toAiAttachment`
keeps just the UI-relevant fields (`id`/`name`/`kind`/`relativePath`) and normalizes
`kind` to `file`/`directory`. `listAttachments` and `deleteAttachment` round out the
CRUD against the same chat-scoped route.

## Upload actions — base64, chat-scoped, unavailable-degrading

```ts
// systems/ai-agent/actions.ts
export async function attachFiles(files: FileList | File[]) {
  const chatId = get(aiAgent).activeChatId;
  if (!chatId) { toast('Start a chat before attaching files.', { tone: 'attention' }); return; }
  try {
    for (const file of Array.from(files)) {
      const content = await readFileBase64(file);                 // strips the data-URL prefix
      if (get(aiAgent).activeChatId !== chatId) return;           // user navigated away mid-upload
      const attachment = await addFileAttachment(chatId, {
        name: file.name, contentType: file.type || 'application/octet-stream', content
      });
      aiAgent.update((s) => s.activeChatId === chatId
        ? { ...s, attachments: [...s.attachments, attachment] } : s);
    }
  } catch (e) { handleAttachError(e, 'Could not attach the file'); }
}

function handleAttachError(e, fallback) {
  if (isUnavailable(e)) {                                          // 404/501 → the Files capability is off
    aiAgent.update((s) => ({ ...s, attachmentsUnavailable: true }));
    toast('Attachments aren’t enabled on this server.', { tone: 'attention' });
  } else { toast(errorText(e, fallback), { tone: 'danger' }); }
}
```

Files upload one at a time so a later failure keeps the earlier successes; a folder pick
becomes one directory upload (`attachFolder`, keyed on each file's `webkitRelativePath`).
Every write re-checks `activeChatId` before committing to the store so a mid-upload chat
switch can't leak another chat's attachments. Because attachments are chat-scoped, the
actions require an open chat and otherwise nudge the user to start one. `loadAttachments`
runs when a chat opens (`selectAiChat`), and `showAiChats` / new-chat sends reset the list
so state always tracks the active chat. The **unavailable** flag is the "nothing hidden"
degradation: on a server without Files, the panel shows a plain "not enabled" note instead
of dead buttons.

## Panel — real File/Folder pickers + attachment list

```svelte
<!-- QuarterbackPanel.svelte — hidden pickers the buttons trigger; folder gets webkitdirectory -->
$effect(() => { folderInput?.setAttribute('webkitdirectory', ''); });

{#if $aiAgent.attachmentsUnavailable}
  <p …>Attachments aren’t enabled on this server.</p>
{:else}
  <input bind:this={fileInput} type="file" multiple class="sr-only" onchange={onFilePicked} … />
  <input bind:this={folderInput} type="file" class="sr-only" onchange={onFolderPicked} … />
  <Button disabled={!$aiAgent.activeChatId} onclick={() => fileInput?.click()}>… File</Button>
  <Button disabled={!$aiAgent.activeChatId} onclick={() => folderInput?.click()}>… Folder</Button>
  {#if !$aiAgent.activeChatId}<p>Start a chat to attach files.</p>
  {:else if $aiAgent.attachments.length}<ul>…each with a remove button…</ul>{/if}
{/if}
```

The buttons drive hidden `<input type="file">` pickers (the folder one gets
`webkitdirectory` set imperatively, since it isn't in the HTML attribute types). They are
disabled until a chat is open, with an inline hint. Uploaded attachments render as a
removable list. The former `mockUpload` toast and its `toast` import are gone.

## Known follow-up (tracked, not hidden)

Attachments can only be added to an **existing** chat, so attaching before the first send
means: send once to create the chat, then attach. A "pending attachments before first
send" queue (stash locally, flush after `createChat`) is a future refinement — noted here
so it stays visible.

## Verification

- `pnpm check` — 0 errors, 0 warnings. `pnpm test` — 261 passed (+4 attachment-client tests).
- Attachment contract matched to Omega source before wiring (base64 body shape, single vs
  directory response split, 404/501 guard).
- Companions byte-verified for all five touched sources.
- Live UI E2E pending (no headless Chrome). To try it on `:8443`: open a chat, click
  **File**, pick a text file, confirm it lists; remove it; on a server without Files, the
  buttons are replaced by the "not enabled" note.
