# The slide deck editor, end to end

Published at https://claude.ai/code/artifact/e7ec113e-cce3-44eb-b5ea-f38e362ffb64

A Konva canvas, a client runtime that buffers what you did, and a pair of remote
procedures that move a deck body between the browser and a JSON-file store.

## Five trees, and what may reach what

The deck is spread across five trees on purpose, and the separation is enforced
by `pnpm lint` rather than by convention.

| Tree | Holds |
| --- | --- |
| `app-views/categories/slide-deck-editor/` | `content/deck.svelte`, `context/stage.svelte`, and `procedures/` — `deck.ts` (body shaping, the only file that names ops), `stage.ts` (geometry), `tokens.ts` (token resolution for canvas) |
| `model/client/slide-deck-runtimes/` | `definition.svelte.ts` (Runtime, register, `tick()`), `methods/apply · attach · sync`, `methods/flush/{coalesce,flush,rebase}`, `methods/history/` |
| `capabilities/slide-deck/` | `index.remote.ts`, `api/read-slide-deck-body/`, `api/submit-slide-deck-changes/` (with `apply-ops.ts`), `api/shared/leader.ts` |
| `representation/data/types/slide-decks/` | `body.ts` (`SlideDeckBody`, `Slide`, `SlideElement`, `Frame`), `op.ts` (`SlideDeckOp`) |
| `surfaces/` | The frame that globs the tree and resolves a key to a component |

A `.svelte` view leaf may import only its own category's `procedures/`, the
component aliases, `$model/client/workspace-state`, and `$capabilities/*`. It may
not touch the runtime register or `$representation` — which is why every deck
type the view needs is re-exported through `procedures/deck.ts`.

**The rule with teeth.** `runtime-through-workspace-state` matches
`/\b(attach|acquire|createRuntime)\s*\(/` against the *raw text* of every view
leaf, markup and comments included. No view file may contain the characters
`attach(` anywhere, which is why the accessor on workspace state is named
`slideDeckRuntime`.

## What the canvas owns

`deck.svelte` takes no props. It reads `view.active.resourceId` for which deck,
and holds a working copy of the body that moves the instant you drag — the
runtime is told afterwards.

| Concern | Where | Why there |
| --- | --- | --- |
| Geometry | `procedures/stage.ts` | A slide is a ratio, not a size. Coordinate space is 1280×720 units for 16:9, 960×720 for 4:3 — height declared, width follows the ratio |
| Element frames | `stage.ts` `toPixels` / `toFrame` | Frames are fractions 0–1, so a deck survives a change of aspect ratio. Conversion in exactly one place |
| Zoom | `TabView.zoom` | Per-tab workspace state, not deck state. An undoable `WorkspaceOp` |
| Colour | `procedures/tokens.ts` | Canvas cannot read CSS variables, and a theme value may be `light-dark(…)` — valid CSS, invalid `fillStyle`. A hidden probe resolves each token through the browser |
| Ops | `procedures/deck.ts` | `withElementFrame` returns `{ body, ops }` together, so body and op cannot disagree |

Zoom is a stage transform, not a redraw: nodes are placed in slide units and
never move when you zoom. Measured at 0.00px canvas/box divergence across 118
frames, down from 19.08px when the canvas was sized by observing the box.

## The runtime

One object per deck, never per tab. It is a courier — it does not know what a
slide is.

| Member | Type | Meaning |
| --- | --- | --- |
| `body` | `SlideDeckBody?` | The last body the leader served |
| `revision` | `number` | What the buffered ops are stated against |
| `sync` | `SyncState` | `loading` · `saving` · `saved` · `rebasing` · `error` |
| `pending` | `number` | Ops buffered, unsent |
| `apply(ops)` | `void` | Record one gesture: undo stack, buffer, schedule |
| `tick()` | `Promise` | Send what it holds, or read what it does not |

Both schedules — the edit debounce and the heartbeat — call the same `tick()`.
Because flush and sync are one branch rather than two timers, a re-read can never
land on top of an edit in flight.

Coalescing folds repeated `set`s on one path into the earliest, keeping the last
`value` and the first `was`. Relatedness is decided on the strings, which is why
the op path grammar is slash-separated: `el-4/frame`.

## How a view reaches a runtime

```
buildClientModel()
  ├── createSlideDeckRuntimes(settings)   built first
  └── createWorkspaceState(…, decks)      borrows it

view.slideDeckRuntime(deckId) → decks.attach(deckId)
  ├── already open → tick(), return it
  ├── settling     → revive, resubscribe
  └── new          → create, subscribe, heartbeat
```

The view acquires it in an `$effect`, never a `$derived`, because `attach` writes
to a `SvelteMap`.

Registration: content key in `workspace/categories.ts` (generated), context key
in `workspace/views.ts`, rail order in `workspace/opening.ts`, label and icon in
`surfaces/context/procedures/rail-entries.ts`. There is no key→component map —
the path is the key.

## What a dragged shape travels through

Outbound: **Konva node** (dragend) → **working body** (optimistic, at once) →
**buffer** (coalesced) → *network* → **validate → applyOps** (baseRevision
checked) → **leader snapshot + change set row**.

Inbound: **leader snapshot** → **readSlideDeckBody** (scope-checked) → *query
cache, bypassed via `.refresh()`* → **runtime.body** → **canvas redraw**.

The change set is `{ resourceId, baseRevision, ops, touched }`. The outbound path
never sends a body; the server rebuilds it from ops it can verify.

1. Drag ends. `toFrame` converts the node position from slide units to a
   fraction; `withElementFrame` returns the next body and one `set` op.
2. The working copy moves immediately — the optimistic apply. `runtime.apply([op])`
   buffers and arms the debounce.
3. Two seconds later, or at fifty ops, `tick()` finds a non-empty buffer and
   flushes. `coalesce` folds a whole drag into one op.
4. The change set crosses once, carrying `baseRevision`.
5. `applyOps` finds the element by id across every slide — a deck has one flat id
   space — and replaces its frame. Nothing partial is written.
6. Two rows land together: a `slideDeckChangeSets` row and the advanced
   `slideDeckSnapshots` leader.
7. The runtime adopts the new revision, then syncs.

A plain re-read answers from SvelteKit's per-argument query cache — measured
stale at revision 2 while the store held 3. `.refresh()` is what defeats it.

## Refusal

A refusal is an answer, not a throw — an exception would be indistinguishable
from a network failure, which needs the opposite handling.

| Reason | Means | Response |
| --- | --- | --- |
| `stale` | Authored against a revision the leader has moved past | Rebase, re-state, retry once. If that fails, revert |
| `unresolved` | An op names something the body does not hold | Revert at once |

Reverting drops the change set, re-reads the body, and leaves the runtime at
`saved`.

## Every number, and where it is set

| Value | Setting | Governs |
| --- | --- | --- |
| 50 ops | `revisions.changeSets.flushAfterOps` | Submit without waiting once the change set is this large |
| 2000 ms | `revisions.changeSets.flushAfterMs` | Debounce, from the last op rather than the first |
| 5000 ms | `revisions.sync.everyMs` | Heartbeat. Zero switches it off, which is what the tests use |
| 720 units | `stage.ts` `SLIDE_UNITS_HIGH` | The slide's declared height; width follows the ratio |
| 50–200% | `stage.ts` `clampZoom` | Below 50 leaves no readable measure; above 200 no slide fits |
| 0.75–2.5 rem | `stage.ts` `gutterOf` | The pasteboard gives way before the slide does |

## Not built

- **Only one op is applicable.** `applyOps` handles `set` on `element/frame` and
  refuses everything else by name.
- **Undo and redo exist and are unbound.** The stacks work and are tested;
  nothing calls them.
- **No resize, rotate, text editing, or slide insertion.**
- **No print model.** `handout` was removed from the body: printing is an
  arrangement of N slides on a sheet, which a page setup has nowhere to hold.
- **A canvas is opaque to a screen reader.** A Layers panel is the intended
  answer.
