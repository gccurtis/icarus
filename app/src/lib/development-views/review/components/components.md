# Review Components

Lives at `src/lib/development-views/review/components/components.md`. This is the one
document for the complete recursive component tree.

## Component Tree

```text
review.svelte
├── picker                           components/picker.svelte
├── state-panel                      components/state-panel.svelte
│   └── value-editor                 components/value-editor.svelte
├── tree                             components/tree.svelte          (context, inspector)
│   └── tree-node                    components/tree-node.svelte     (recursive)
└── grid-map                         components/grid-map.svelte      (workspace)
    └── tree-node                    components/tree-node.svelte
```

`tree` and `grid-map` are alternatives, chosen by `kind`. Both hold `tree-node`,
which renders itself for its children — the only recursion in the tree, and it is
the shape of the thing being drawn rather than a convenience.

## Why the picker is a native `select`

Everything else on the page is plain markup for the same reason: this is
scaffolding *around* the vocabulary and must not be built *from* it. A reviewer
looking at a `PanelSelect` on the stage should never have to work out whether the
control above it is the component under review or part of the tool. The native
control also brings its whole keyboard model for free, which a hand-built listbox
would have to earn back.

## Why the state editor has three shapes

A capability answers three kinds of thing. A scalar gets a field, a flat record gets a
row per key, and everything else gets JSON. One editor for all of them would be a
JSON box for a string; a form for all of them would be a form nobody can use for
a list of forty rows. The JSON box is honest about the case it covers rather than
pretending to be a structure editor.

The JSON box commits on blur and on *Apply*, never on every keystroke, because a
half-typed object is not JSON and a panel that threw on every character would be
unusable.

## Why the composition column is read-only

Everything in it is derived from the state above the stage. A prop editable here
would be a second answer to what the panel is a function of, and the two would
disagree the moment an answer changed. Change the answer; watch this move.

## Why `grid-map` reads the DOM

A workspace's specification is a grid, so its composition read as a flat stack
loses the only structure a reviewer is checking. The tracks, the area names and
which region a component landed in all come from the computed style and the
markers the primitives put on their roots — not from a parse of the source. A
parse would be a second copy of the CSS to keep in step; the computed style *is*
the CSS, so a region that was renamed shows up renamed.

A component whose root is another component rather than an element marks no DOM,
so it cannot be placed in a region. Those are listed under *outside every region*
rather than dropped, because a missing name reads as a missing component.

## Inventory

- [`grid-map.svelte`](grid-map.svelte)
- [`picker.svelte`](picker.svelte)
- [`state-panel.svelte`](state-panel.svelte)
- [`tree.svelte`](tree.svelte)
- [`tree-node.svelte`](tree-node.svelte)
- [`value-editor.svelte`](value-editor.svelte)
