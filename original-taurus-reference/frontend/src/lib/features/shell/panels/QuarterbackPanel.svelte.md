# QuarterbackPanel.svelte

The AI Agent inspector panel — the permanent right-rail section the composer bar activates.
Backed by real Omega chats/turns/tasks (no mock).

> **Rewritten 2026-07-27 (workstream D, catalog A3).** The file was a 623-line monolith holding
> five concerns (sources, attachments, chat list, transcript, task card) in one scope with no
> sub-components; this companion was its byte-mirror. Both are now decomposed: the concerns
> live under [`quarterback/`](quarterback/), and only the **view switch** lives here — the same
> shape as `DetailsPanel` after workstream A.

## The three views

- **`managingContext`** (panel-local state) → [`ContextManager`](quarterback/ContextManager.svelte.md),
  with `onback` flipping the flag off.
- **`$aiAgent.view === 'chats'`** → the mode header (current mode's label + cue copy from
  `aiModeCopy`), the [`ContextSection`](quarterback/ContextSection.svelte.md) disclosure, and
  the [`ChatList`](quarterback/ChatList.svelte.md).
- **`$aiAgent.view === 'conversation'`** → the sticky chat header (back to chats via
  `showAiChats`, the active chat's title and fixed-mode badge), the same `ContextSection`, the
  [`Transcript`](quarterback/Transcript.svelte.md), and the
  [`TaskCard`](quarterback/TaskCard.svelte.md).

## What stays here

Panel-level lifecycle only: the `managingContext` flag both non-manager views can enter
(`onmanage`), the `activeChat`/`modeLabel` derives the headers need, and the chats loader —
`loadChats()` once per project, guarded by `loadedProject` so tab switches don't reload (the
store resets per project).

Pure display maps (mode/task tones and labels, todo glyphs, relative time) are in
[`quarterback/helpers.ts`](quarterback/helpers.ts.md); the context-item projection is the
tested [`quarterback/context-items.ts`](quarterback/context-items.ts.md).
