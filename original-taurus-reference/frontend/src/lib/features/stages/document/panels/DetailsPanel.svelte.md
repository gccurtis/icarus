# DetailsPanel.svelte

The Details inspector — the action lens for whatever is currently inspected. As of the
workstream-A decomposition this file is **only a dispatcher**: it resolves the session, shows
the no-document and no-canonical-layout states, and hands off to one of five lens components.

It was 910 lines carrying seven lenses, thirteen controls, and thirteen pieces of state in one
scope. Everything moved to `details/`; what remains is the part that genuinely belongs to the
panel — deciding which lens is showing. Workstream D then deleted two of the seven lenses
(`RowLens`, `BlocksLens`): their only entry point, the left-margin gutter, was removed on
2026-07-23 and stays removed by design (UX1 — editing must *feel* like a smooth text editor,
with no block-manipulation chrome; the block data model itself stays).

## The empty state

```svelte
{#if !$editorSession}
  <p class="text-body-sm text-muted">
    Nothing to inspect yet — open a document and select content here.
  </p>
{:else}
```

A null session means no document stage is active at all — a different situation from a document
with nothing selected, which is the None lens. The panel is mounted permanently on the inspector
rail, so both states have to read as intentional rather than broken.

## The canonical-layout notice

```svelte
<CanonicalLayoutNotice
  enabled={selection.mode !== 'none'}
  class="mb-3"
  message="Alignment, indent, and line-spacing changes preview locally but are not saved for this document."
/>
```

Some documents have no canonical layout, and for those the layout controls still preview locally
but never persist. The notice is shared with `LayoutPanel` (see
`shared/CanonicalLayoutNotice.svelte`), which owns the condition and the styling while each panel
words it for the controls it actually offers. It is suppressed when nothing is selected: with no
target there is no pending change to warn about.

## The dispatch

```svelte
{@const selection = $editorSession.selection}
{#if selection.mode === 'none'}
  <NoneLens />
{:else if selection.mode === 'run'}
  <RunLens {selection} />
{:else if selection.mode === 'new-text'}
  <NewTextLens {selection} />
…
{:else}
  <!-- row / blocks: frozen vocabulary with no producer — fall back to NoneLens -->
  <NoneLens />
{/if}
```

`SelectionInfo` is a discriminated union, so each branch narrows it and the lens's prop type is
the narrowed variant. A lens therefore cannot read a field belonging to another mode — the
dispatch that used to be a convention inside one long `{#if}` chain is now enforced.

The final `{:else}` is defensive: `row` and `blocks` remain in the frozen `SelectionInfo`
vocabulary (`editor/session.ts` does not change during the reorg), but nothing has produced
them since the gutter's removal, and their lenses were deleted in workstream D. If one ever
appears it renders as the None lens rather than a blank panel.

Each lens owns its own controls, its own local state, and its own targets. That last point is
what fixed bug **B1**: a single panel-wide derive tried to compute row keys for every mode at
once and produced an empty list for a text run, so Line spacing silently did nothing there. Now
`RunLens` names its rows (`selection.rowIds`, supplied by the runtime) and every other lens
derives its own from its blocks.

## What the panel deliberately does not do

No state, no actions, no store writes beyond reading `editorSession`. Anything shared between
lenses lives in `details/controls/` (a component) or `details/lens-helpers.ts` (a pure
function), so this file has no reason to grow as controls are added.

The contract it reads — `editor/session.ts` — stays frozen through the reorg, so this panel and
the shell do not move when the runtime is split apart underneath.
