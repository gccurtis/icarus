# Document editor Phase-1 tail: redo, last-editor, layout-gate notice, dead-client cleanup

Completes the remaining Phase-1 goals from
[docs/integration/current/alpha-implementation-plan.md](../integration/current/alpha-implementation-plan.md).
All backend round-trips verified against a fresh build of Omega `main`.

## Goal 1.4 — Wire redo in the History panel

`redoChange()` existed but was never called. The change-detail modal now shows a contextual
action: **Redo this change** when the selected entry is redo-eligible (`canRedo`), else **Undo
this change** (`canUndo`). Verified: append → undo (`201`, entry becomes `canRedo`) → redo
(`201`, the edit is restored).

## Goal 1.5 — Last-editor attribution from history

"Edited … by X" was hardcoded to the current user. Added `lastEditorInfo` + `refreshLastEditor`
(collaboration.ts): the document bar now derives the last editor from the **newest history
entry's author** (matched to the current user so "You" still shows), refreshed on document load
and after each change lands.

## Goal 1.6 — Surface the silent layout capability-gate

Layout ops (`set_page_layout`, alignment, line height) only persist when the document has
canonical layout; otherwise they were local-only with no indication. Exposed
`supportsCanonicalLayout` on the editor session and added a "changes preview locally but are not
saved" notice in the Layout and Details panels when it's false.

## Goal 1.7 — Retire the dead row-window client

`systems/documents/rows.ts` implemented four `/documents/:id/{descriptor,row-manifest,rows,
rows/locate}` calls for routes Omega has never had — dead code with no consumer. Removed the
file (and the `$data/document-rows` shim), keeping only the one used type `RowManifestEntry`,
which moved to `types.ts` (the local pagination row-repository is its only user).
