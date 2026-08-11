# Chat attachments (backend-outstanding Phase A)

A chat can carry uploaded **files** and browser **directory manifests**, stored
durably and surfaced to the agent as context. The bytes reuse the existing `file`
capability; the chat capability stores only the reference and presentation
metadata, so it never imports `file`.

## Capability (`core/capability/chat`)

- **`Attachment{ ID, ChatID, ProjectID, Kind, FileID, Name, RelativePath,
  DirectoryUploadID, CreatedAt }`.** `Kind` is `file` (a single upload) or
  `directory` (one file of a directory upload — its siblings share a
  `DirectoryUploadID` and carry their browser-relative paths).
- **`AttachmentStore`** port: `CreateChatAttachment` / `ChatAttachmentsByChat` /
  `ChatAttachmentByID` / `DeleteChatAttachment` (globally-unique names, `Chat`
  prefix). `MemoryChatStore` implements it too, for tests.
- `Chats` gains an optional `attachments` store (`UseAttachments`); a nil store
  makes the methods return `ErrAttachmentsUnavailable`. `AddAttachment` /
  `Attachments` / `DeleteAttachment` each prove the chat (and the attachment)
  belong to the trusted current Project before acting. `NewDirectoryUploadID`
  mints the id that groups a manifest.

## Persistence

`agent_chat_attachments(id, project_id, chat_id, kind, file_id, name,
relative_path, directory_upload_id, created_at)` + an index on `(chat_id,
created_at)`.

## Endpoints (behind the existing project gate; carry `:chatID`)

- `POST /agent/chats/:chatId/attachments` — `{name, contentType, content}` (single,
  base64) or `{directory: [{relativePath, name, contentType, content}]}` (manifest,
  batch). Uploads each file's bytes via the file capability, then records the
  attachment(s).
- `GET  /agent/chats/:chatId/attachments` → `{ attachments: [...] }`.
- `DELETE /agent/chats/:chatId/attachments/:attachmentId` → `204`.

## Bounds (config)

Per-file size is enforced by the file capability. `agents.attachments.
max_directory_files` (default **256**) caps how many files one directory manifest
may carry — config-driven so it tunes without a code change.

## Agent context

The chat→agent engine adapter (composition root) resolves a chat's attachments
into `ContextItem`s for every Ask/Action/Plan turn: each attached file whose bytes
decode as bounded UTF-8 text (≤ 32 KiB) is offered as untrusted source material,
labeled by its (relative) name; binary or unreadable files are listed, not
inlined. The chat capability stays free of `file`; the adapter reads bytes and
builds the items. `ChatReplyRequest` gained `ChatID` so the adapter knows which
chat's attachments to resolve.

## Tests

- Unit (`core/capability/chat`): add + list; Project-scoped add/list/delete;
  directory attachments share an upload id and keep relative paths; blank fileId
  rejected.
- Dev-test (`dev-test/chat-attachments`): free flow (upload single, upload
  manifest, list, cap, delete) always runs; a live section (skip-on-no-key) proves
  an Ask turn answers a question only the attached file's content can answer.

## Settled

- Files + directory manifests in the first cut. ✓
- Bytes reuse the file capability; chat stores only references. ✓
- Caps in config (per-file via file cap; directory count via config). ✓
- No content scanning; normal project-deletion retention. ✓
- Attachments feed the agent as context via the composition adapter. ✓
