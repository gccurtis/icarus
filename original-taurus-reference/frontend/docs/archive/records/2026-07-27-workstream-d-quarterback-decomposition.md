# 2026-07-27 — Workstream D, part 5: QuarterbackPanel decomposed (A3)

`QuarterbackPanel.svelte` was the last monolith: 623 lines holding five concerns — sources,
attachments, chat list, transcript, task card — in one scope with no sub-components. It is now
an ~80-line **view switch**, decomposed the same way `DetailsPanel` was in workstream A. Markup
and behavior are unchanged; every block moved verbatim into the component that owns it.

## The new `shell/panels/quarterback/`

Components (store-driven, no props except the two navigation callbacks):

- **`ContextSources.svelte`** — the sources checkbox grid, rendered by both the disclosure and
  the manager so a toggle is identical in both places.
- **`ContextAttachments.svelte`** — the chat-scoped attachments block: capability degrade,
  hidden File/Folder pickers (including the imperative `webkitdirectory`), the attached list.
- **`ContextSection.svelte`** — the collapsible Context disclosure composing the two above plus
  the "Current context" button (`onmanage`).
- **`ContextManager.svelte`** — the full-panel Current-context view (`onback`); owns its search
  state, so leaving the view resets the query instead of the old explicit reset.
- **`ChatList.svelte`** — Recent chats with its loading/error/empty states.
- **`Transcript.svelte`** — author-tinted messages + the "Working…" indicator.
- **`TaskCard.svelte`** — the spawned task and the Plan-mode draft with the real Accept action.

Pure modules:

- **`helpers.ts`** — mode/task tone+label maps, todo glyphs, `relTime`.
- **`context-items.ts`** — the context-item projection (`contextItemsFor`, `filterContextItems`)
  as pure functions of the store values, with **`context-items.test.ts`** (+5 tests, suite now
  343) pinning the rules: a "new tab" contributes no document, knowledge never lists the open
  resource twice, exclusions filter last, search matches name+type case-insensitively.

The panel keeps only the view switch, the headers' derives, and the once-per-project
`loadChats` effect.

## Docs

Catalog A3 struck; orientation updated (remaining: optional L5/L6, PC1). Companions: eight new
under `quarterback/`, and `QuarterbackPanel.svelte.md` rewritten as prose (was the 623-line
file's byte-mirror).

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — **343/343** (+5)
- `pnpm build` — clean
- companions — verifier OK on all ten touched sources
- `pnpm test:e2e` — **14/14** (the persona spec drives this panel against the real model:
  composer → chat creation → agent turn)
