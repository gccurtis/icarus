# Still needed from the backend — SUPERSEDED (2026-07-27)

> ## ⛔ Do not use this list.
>
> **The single source of truth for what Omega should build is
> [`docs/backend-requests/README.md`](../../backend-requests/README.md).**
>
> This file was a second, parallel "what Omega must build" list, and by 2026-07-27 it had gone
> stale on six of its seven items. Two competing lists is exactly the ambiguity the backend-requests
> index now exists to prevent, so this one is retired rather than re-synced.

## What this list said, and what was actually true on 2026-07-27

| Item here | Reality |
|---|---|
| **G3** — PDF / DOCX export & import | **Deferred by Alpha**, not requested. See [`docs/deferred/pdf-docx-import-export.md`](../../deferred/pdf-docx-import-export.md). |
| **G5** — native `list` kind + general indent | ✅ **Shipped.** Omega has `BlockKindList` and a block indent; Alpha ships native lists. |
| **G6** — document / per-kind typography defaults | ✅ **Shipped.** `Base.DefaultTypography` + `set_default_typography`; Alpha's Layout lens sets it. |
| Workspace state | ✅ **Shipped.** `GET/PUT /workspace`. |
| Project member summary | ✅ **Shipped.** `GET /projects` returns a bounded `members` summary. |
| Chat attachments | ✅ **Shipped.** `POST/GET/DELETE /agent/chats/:id/attachments`. |
| Notification preferences | **Not wanted.** Alpha is not building the notifications surface at all — see [`docs/deferred/notifications-feed.md`](../../deferred/notifications-feed.md). |

## The actual open list, as of 2026-07-27

Three requests, each written standalone:

1. [Validate document mark payloads](../../backend-requests/document-mark-payload-validation.md) — **high, security**
2. [Per-turn / per-task persona override](../../backend-requests/persona-override-per-turn-and-task.md)
3. [Live collaboration presence](../../backend-requests/live-collaboration-presence.md)

## Why this file is kept

The **no-hide rule** it states is still right — a capability that needs backend work stays visible
in the UI with a clear affordance rather than being hidden, so it does not get forgotten. That
principle moved to the backend-requests README; the inventory did not.
