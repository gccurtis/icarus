# NoneLens.svelte

What the inspector shows when a document is open but nothing inspectable is selected.

## Document-level facts and a way forward

```svelte
<p class="truncate text-body-sm font-medium text-primary">{$editorSession.name}</p>
<Facts items={[
  { label: 'Blocks', value: String($editorSession.blocks) },
  { label: 'Words', value: String($editorSession.words) }
]} />
<p class="text-caption text-muted">Select text or place the caret to inspect content.</p>
```

The empty state is deliberately not blank. It names the document, gives whole-document counts
(the only scope that exists when nothing is selected), and states the two ways to get a
selection. The copy used to mention a left-margin handle; that gutter was removed on
2026-07-23 and stays removed by design (UX1 — editing must *feel* like a text editor, no
block-manipulation chrome), so the line now names only what exists.

This is the one lens with no `selection` prop: `{ mode: 'none' }` carries no data, so everything
here comes from the session. The `{#if $editorSession}` guard is for the type-narrowing only —
the orchestrator never renders this without a session.
