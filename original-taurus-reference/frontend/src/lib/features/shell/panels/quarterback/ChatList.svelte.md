# ChatList.svelte

The **Recent chats** section of the AI Agent panel. Four states, in priority order: loading
(only while the list is still empty, so a background refresh never blanks an existing list),
error (the store's message, or a fallback), empty (with a nudge toward the composer bar), and
the list itself.

Each row is a button that opens the chat via `selectAiChat`, showing the title, the chat's
fixed-mode badge (`modeTones`/`modeName` from [`helpers.ts`](helpers.ts.md) — a chat's mode is
set at creation, it is not a live status), and `relTime(chat.updatedAt)` on the right.
