# Context Panel Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`rail-entries.ts`](rail-entries.ts) | `RAIL_ENTRIES` — a label and an icon for each of the ninety-two context views |

## What is here, and what belongs to the model

One thing: what a rail entry *looks like*. Which views exist, which subscreen
offers which, in what order, and what to do with a stored id that has drifted out
of range all belong to `$model/client/view-state` — it answers
`railFor(screen, subscreen)`, and the drift fallback is its `context` getter.

That split follows the shape of the two halves. The ids are generated from the
`context/` tree and the rails are transcribed from the specifications, so both
are facts the state that remembers a rail position can hold and check. A label
and an icon are judgements: a label is the view's name as its specification
writes it rather than its file name, and an icon has to say what the view is for
*and* survive sitting next to its neighbours in the same rail. Neither can be
derived from a path, so neither is generated.

## Why the rail table is not markup

`Record<ContextId, RailEntry>` is total rather than `Partial`, so a new context
view fails to compile until it has been given both halves. A rail entry that
cannot be drawn is a rail with a hole in it, and finding that at runtime is
strictly worse than finding it at build time — in the markup the same lookup
would silently render nothing.

The rest — which component a chosen id resolves to — stays in
[`context-panel.svelte`](../context-panel.svelte), where an id is a path and
there is no map to keep in step at all.
