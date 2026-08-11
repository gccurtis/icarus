# 2026-07-27 — The runtime grows a model layer (workstream C, partial)

Workstream **C** of the [document-subsystem reorg](../plans/2026-07-27-document-subsystem-reorg.md):
split the `DocumentRuntime` god-object into named collaborators under `model/`, in the plan's
low→high-risk order. **Three of the five extractions shipped** — `SelectionModel`,
`OptimisticOverlay`, `PresentationPass` — along with both correctness items the workstream owned
(**B2**, **B3**) and the repeated-idiom cleanup from §3. `EditorActions` and `SyncEngine` remain;
see *What is left* below.

`runtime.ts`: **1569 → 1310 lines**, and 20 new unit tests where previously there were none for
this layer.

## model/selection.ts — the lens rules become testable

```ts
export function deriveSelection(
  state: EditorState,
  inspection: InspectionOverride | null
): DerivedSelection
```

The whole ProseMirror→inspector translation moved out as pure functions of an `EditorState`. It
went first because it was already almost pure — those methods only ever *read* state.

One thing could not move unchanged: the original assigned `this.inspection = null` when a pinned
inspection stopped resolving. A pure function cannot, so it returns `clearInspection` and a
four-line wrapper commits it. **The model computes, the orchestrator commits** — the shape every
extraction here follows.

The payoff is `selection.test.ts`: 11 tests pinning all seven lenses, including that a code block
inspects as `block` (never the typography lens), that a callout does offer Next Text, and the
`rowIds` contract behind bug B1. Exercising a lens previously meant standing up a whole runtime
and its network stack.

## model/overlay.ts — the B2 invariant made explicit

The bug, stated plainly: an optimistic alignment was applied by rewriting `Block.style` on the
**live snapshot object**, *and* mirroring a copy into a pending map. Two sources of truth for one
fact. The mutation was load-bearing in a way nothing declared — `diffDoc` builds each next block
as `{ ...previousBlock }`, so the optimistic style survived a flush only because the object being
spread was the one that had been mutated. A defensive copy anywhere in that chain would have
silently reverted alignment and indent, with no error and no failing test.

```ts
// The step that used to happen by accident, now stated:
this.overlay.settle(extras);
this.snapshot = this.overlay.applyTo(nextRows);
```

The overlay owns the patches; readers resolve `overlay ?? snapshot`; the snapshot is never
written. `applyTo` folds pending styles into the differ's `nextRows` explicitly when a new
snapshot is adopted, returning fresh objects so no aliasing is reintroduced.

`overlay.test.ts` pins it with nine tests — including a differ round-trip that reproduces
`{ ...previousBlock }` and fails without `applyTo`, and the copy-on-read behaviour of
`pendingOps()` that stops `settle` from stripping an op queued mid-flight.

## B3: the extras-before-diff ordering is now stated, not implied

```ts
// ORDER IS LOAD-BEARING: inspector-queued "extra" ops (set_prompt, the style
// ops, alignment/indent) are sent AHEAD of the differ's ops. A style
// definition must exist before the op that references it, and a block op must
// land before content edits that could re-key the block. …
const extras = this.overlay.pendingOps();
```

The behaviour is unchanged; what changed is that the reason is written down at the site that
depends on it.

## model/presentation.ts — one pass, two consumers

`computeRowHeights` and `computeBlockDecorations` are split so the runtime keeps its
short-circuit: hash the row heights, return early when unchanged, and only pay for the decoration
walk on a real change. `projectDocument` yields the outline, row keys, and counts in one walk.

The retained `rowHeightsPx` map is published *as-is* in the session, so the inspector's
Line-spacing value and the painted `min-height` are the same numbers rather than two derivations
of one rule (catalog **P-1**).

## commitOverlayEdit — naming the repeated idiom

```ts
  private commitOverlayEdit() {
    this.refreshPresentation(true);
    this.hooks?.onState(this.state);
    if (this.supportsCanonicalLayout) {
      this.setInfo({ save: 'pending' });
      this.scheduleFlush();
    }
    if (this.attached) this.updateSession();
  }
```

Overlay-backed edits change nothing the differ can see, so `dispatch` never runs and they must
drive the whole cycle by hand. **Seven** actions repeated this exact sequence — the plan's §3
listed it as "one repeated optimistic-cache idiom at ~9 sites". Each action now states what it
changed; this states what that always implies.

`setDefaultTypography` deliberately does not use it: the document-wide default renders through
the stage's CSS variable, not block decorations, so it has no presentation refresh to do. Worth
recording, because collapsing it for uniformity would have added a pointless full repaint to
every base-font change.

## model/panels.ts — the runtime stops importing UI

The rail section list moved out, removing ten Svelte component imports and ten icon imports from
the sync class (catalog **A1**, partially).

## What is left, and why it stopped here

Two extractions from the plan's §4 order remain, both of them the ones it deliberately sequenced
**last**:

- **`EditorActions`** — ~570 lines still inside `runtime.ts`. Measured coupling: 31 distinct
  runtime members. That number is itself the finding — the actions really do touch everything,
  so moving them behind a 31-member interface would relocate code without creating a seam. The
  `commitOverlayEdit` extraction above is the first genuine reduction of that surface; more of
  the same (naming the other shared sequences) should precede the file move.
- **`SyncEngine`** — `load`/`flush`/`reload`/retry, which own `docId`/`revision`/`snapshot`/
  `meta`/`layoutRules`/`styleRegistry`/`supportsCanonicalLayout`. The actions and the
  presentation pass read all of those, so this is the most entangled boundary of the five.

Stopping between `presentation` and `actions` is a plan-sanctioned boundary, not an arbitrary
one: the three shipped extractions are the ones carrying **model correctness**, and both bugs
this workstream owned are fixed. `runtime.ts` at 1310 lines is meaningfully better but is **not
yet the thin orchestrator** the plan targets — catalog **A1** stays open.

## Verification

`pnpm check` 0 errors / 0 warnings · **304 unit tests** (up from 284; +20 across selection and
overlay) · `pnpm build` clean · companions fresh · `e2e/document-inspector.spec.ts` 5/5 against
real Omega after each of the three commits — the Backspace-outdent test matters most here, since
`indentOf` now resolves through the overlay rather than a mutated snapshot. The pre-existing
`resources.spec.ts` Slides drift is unchanged.
