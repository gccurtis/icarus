# Context Panel Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`resolve-context.ts`](resolve-context.ts) | `CONTEXT_IDS`, `CONTEXTS_BY_SCREEN`, `resolveContext` |

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
