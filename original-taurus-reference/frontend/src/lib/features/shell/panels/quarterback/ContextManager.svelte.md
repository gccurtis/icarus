# ContextManager.svelte

The **Current context** manager — the full-panel view behind the Context disclosure's button.
It lists exactly what the enabled sources contribute right now, searchable, each item
removable. `onback` (its only prop) returns to the panel's previous view.

- The item list is `contextItemsFor(...)` over the live stores (`aiAgent`, `workspace`,
  `resources`) — the projection itself is the pure module
  [`context-items.ts`](context-items.ts.md), tested in node.
- The search box filters through `filterContextItems`; the empty state distinguishes "no
  matches for this search" from "nothing included at all".
- **Removal semantics**: whole-source items — the document, the selection — *toggle their
  source off* (removing "the document" from context and disabling the document source are the
  same intent); per-item entries (a knowledge resource, a linked source) are excluded singly
  via `excludeAiContextItem`.
- Owns its search state, so leaving the view (the component unmounts) resets the query — the
  old panel needed an explicit reset on close.
- The sticky header uses the same `-mx-3 px-3` trick as the conversation header to span the
  panel's padding.
