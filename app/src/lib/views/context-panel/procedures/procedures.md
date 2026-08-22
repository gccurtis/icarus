# Context Panel Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`resolve-context.ts`](resolve-context.ts) | `CONTEXT_IDS`, `CONTEXTS_BY_SCREEN`, `resolveContext` |
| [`rail-entries.ts`](rail-entries.ts) | `RAIL_ENTRIES` — a label and an icon for each of the ninety context views |

## Why there are two vocabularies here at once

`resolve-context.ts` serves the shell as it is: sixteen ids over twelve screens,
with its own components. `rail-entries.ts` serves the shell as
`docs/screen-panel-views` describes it: ninety views under `$context`, ordered by
`$model/client/view-state`'s rails.

They stand together only while the shell is being moved from one to the other.
`resolve-context.ts` goes when the panel stops rendering its own components.

## Why the rail table is not generated

The order and the membership already are — `view-state`'s `RAILS` is transcribed
from the specifications and its ids are generated from the tree. What cannot be
derived is what an entry *looks like*: a label is the view's name as its
specification writes it, not its file name, and an icon is a judgement about what
the view is for that also has to survive sitting next to its neighbours in the
same rail.

It is typed `Record<ContextId, RailEntry>` and not `Partial`, so a new context
view fails to compile until it has been given both. A rail entry that cannot be
drawn is a rail with a hole in it, and finding that at runtime is strictly worse
than finding it at build time.

## Why the vocabulary is here and not in the model

The workbench remembers a `contextId` per tab and **never interprets it** —
exactly as it remembers an inspection key. Which contexts exist, which screen
offers which, and what to do with a stored id that is no longer on the rail are
all this panel's.

The alternative put the menu in the model, and the cost was a model type that
grew a member for every screen that arrived. Keeping it here means the model's
surface stops changing when a screen does, which is what let the workbench land
without the screens existing.

## Why `resolveContext` is a procedure

**Because the fallback has a wrong answer.** A tab's remembered context can drift
out of range — a templates tab switching mode swaps to a disjoint rail, and a
stored id can outlive the context it named. A reset rail is harmless; a crash
during paint is not.

That is the one piece of context logic worth testing, and there is no
component-render harness in this project. In `procedures/` it is a pure function
over `(screen, stored)` with a unit test; inside the component it would be a
line nothing could reach.

The rest — which icon, which label, which component — stays in the markup, where
adding a context is an edit to the surface that renders it.
