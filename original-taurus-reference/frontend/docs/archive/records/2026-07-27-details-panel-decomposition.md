# 2026-07-27 — The Details inspector becomes a 42-line dispatcher

Workstream **A** of the [document-subsystem reorg](../plans/2026-07-27-document-subsystem-reorg.md),
issue **A2** in the [catalog](../plans/2026-07-27-document-subsystem-issues.md).
`DetailsPanel.svelte` was **910 lines** holding seven selection lenses, thirteen controls, and
thirteen pieces of state in one scope — the file most responsible for changes here feeling slow.
It is now **42 lines** that do nothing but dispatch.

The bug fix that shipped first
([the run-mode line-spacing no-op](2026-07-27-run-line-spacing-fix.md)) is what this structure
makes impossible to reintroduce.

## The panel is now only a dispatch

```svelte
{@const selection = $editorSession.selection}
<CanonicalLayoutNotice enabled={selection.mode !== 'none'} class="mb-3" message="…" />
{#if selection.mode === 'none'}
  <NoneLens />
{:else if selection.mode === 'run'}
  <RunLens {selection} />
{:else if selection.mode === 'new-text'}
  <NewTextLens {selection} />
…
```

`SelectionInfo` is a discriminated union, so each branch narrows it and each lens declares the
narrowed variant as its prop type. Two things follow that were previously only conventions: a
lens **cannot** read a field belonging to another mode, and adding a mode is a compile error
until it is handled here. The seven-way `{#if}` chain that used to interleave 900 lines of
markup is now legible at a glance.

Behaviour is unchanged. Every control, label, `aria-label`, and class moved verbatim; the
inspector e2e spec passes without modification, which is the point of doing the move separately
from the bug fix.

## Each lens owns its targets

```svelte
<!-- RunLens -->
<TextTypeAndSpacing
  subKind={selection.subKind ?? 'body'}
  rowKeys={selection.rowIds}
  blockIds={selection.blockIds}
/>

<!-- BlockLens -->
const blocks = $derived([selection.block]);
const rowKeys = $derived(rowKeysOf(blocks));
const blockIds = $derived(blockIdsOf(blocks));
```

This is the structural half of the B1 fix. One panel-wide `inspectedRowKeys` derive previously
tried to cover every selection mode at once, and produced an empty list for a text run — so
`setRowHeight([], …)` resolved no rows and Line spacing silently did nothing on selected text.
There is no longer a place for that class of bug to live: a control that needs a target takes it
as a prop, and a lens that has no sensible target does not render the control at all.

## Each control owns its state

```ts
// RowHeightControl.svelte — was two of thirteen state vars in the panel
let lineSpacing = $state<number>(0);
let lineSpacingFor = $state('');
```

The thirteen state variables were distributed to the controls that use them: the colour popovers
and the link draft into `TypographyControls`, the line-spacing seed into `RowHeightControl`,
alignment into `AlignmentControls`, the prompt draft into `PromptControls`, the child widths into
`RowLens`. Each moved together with its seeding `$effect`, so the "re-seed on a key change, never
clobber a draft mid-edit" idiom now sits next to the field it protects rather than in a block of
five effects that had to be read as a group.

The largest remaining file is `TypographyControls.svelte` at 209 lines, and it is one coherent
thing: inline marks.

## Two duplications removed

```svelte
<!-- one component, both accessible names preserved -->
<TextTypeSelect value={selection.block.subKind ?? 'body'} ariaLabel="Text type" />   <!-- BlockLens -->
<TextTypeSelect value={subKind} />                                                  <!-- default: "Style" -->
```

The Body/Heading select existed twice with identical options and handler but different labels.
Deduping it kept **both** names — they are how the controls are addressed by assistive tech and
by the e2e specs, so collapsing them to one would have been a silent behaviour change made for
the refactor's convenience.

`shared/CanonicalLayoutNotice.svelte` does the same for the "this won't be saved" banner that
`DetailsPanel` and `LayoutPanel` each carried a copy of. It owns the condition
(`supportsCanonicalLayout`) and the styling; each panel keeps its own sentence, because the
inspector warns about *alignment, indent, and line spacing* while the Layout panel warns about
*page and block layout*, and one generic wording would have made both vaguer.

## Layout

```
panels/
  DetailsPanel.svelte              42 lines — empty state + notice + 7-way dispatch
  details/
    lens-helpers.ts                narrowed selection types, rowKeysOf/blockIdsOf, selectionKey
    lenses/   None Run NewText NewBlock Block Blocks Row
    controls/ Facts ColorPopover TypographyControls TextTypeSelect TextTypeAndSpacing
              RowHeightControl IndentControl AlignmentControls AddCommentControl
              AddColumnControls InsertElementControl PromptControls ListControls
  shared/CanonicalLayoutNotice.svelte
```

Every new file has a prose companion. The one snippet not given its own file is the former
`mockBadge` — a single `<MockBadge>` element used once, now inline in `RowLens`; a file and a
companion for it would have been ceremony, not structure.

`editor/session.ts` stays the contract between the runtime and these panels, so none of this
moves when the runtime is split apart in workstream C.

## Verification

`pnpm check` 0 errors / 0 warnings, 284 unit tests, companions fresh, and the full inspector e2e
spec (5 tests, real Omega) green — including the B1 regression test. Two pre-existing failures
were confirmed unrelated by re-running them with this work stashed: `document-pagination.spec.ts`
does not load under Node (it imports app source that transitively pulls `.svelte` files; the
whole pagination stack is deleted in workstream B), and `resources.spec.ts` asserts Slides is
disabled, which is the Omega drift the orientation doc already records.
