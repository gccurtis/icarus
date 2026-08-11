# Document Trash and Restore (R14)

Replaces hard-delete with trash-and-purge lifecycle for Documents.

## What changed

- **Document model** — added `Lifecycle` field (`"active"` | `"trashed"`)
  and `TrashedAt` timestamp. New documents default to `"active"`.

- **Delete → trash** — `DELETE /documents/:id` now marks the document as
  trashed. Content and history are preserved. Activity fact: `"trashed"`
  (sourceKind `"document.trash"`).

- **Restore** — `POST /documents/:id/restore` moves a trashed document
  back to active. Activity: `"restored"`.

- **Purge** — `DELETE /documents/:id/purge` hard-deletes a trashed
  document. Requires prior trash step. Activity: `"purged"`.

- **PurgeStale** — runs at startup. Queries every trashed document past
  the configured retention period (default 30 days) and purges it. Uses
  system actor for activity.

- **Store** — added `SetLifecycle` and `TrashedDocumentsOlderThan` to
  the Store interface. SQLite migration adds `lifecycle` and `trashed_at`
  columns. `DocumentsByProject` and `DocumentSummaries` now filter to
  `lifecycle = 'active'` — trashed documents are hidden from lists but
  remain Gettable.

- **Config** — `documents.trash_retention` (duration string, default
  `"720h"`). Parsed in wiring and passed as `TrashRetention` option.

- **Activity whitelist** — added `trashed`, `restored`, `purged` to the
  SQLite `insertDocumentActivity` action gate.

## Why

R14 from the document backend checklist. Rather than immediately destroying
data on delete, trash preserves content for a retention window. Restore
lets users recover. Purge and PurgeStale provide the escape hatch for
permanent removal. This is the foundation document lifecycle — archive,
duplicate, and templates (R15-R16) build on it.
