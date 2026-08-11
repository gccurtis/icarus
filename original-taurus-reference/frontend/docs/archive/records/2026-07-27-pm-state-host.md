# 2026-07-27 — PmStateHost: the transaction pipeline gets an owner (workstream C, C6)

The sixth and last of the `model/*` units the [reorg plan](../plans/2026-07-27-document-subsystem-reorg.md)
§4 named. It was deliberately sequenced *before* the actions extraction, on a measurement rather
than a hunch: the ~540-line actions object touched `state` (37), `dispatch` (16), and `hooks` (15)
— 68 uses of three fields that are one concern. Folding them into a single collaborator is what
makes the actions' surface small enough to move behind a contract instead of relocating code.

**Result: the actions' distinct runtime coupling fell 24 → 20**, and the three biggest contributors
became one (`this.pm`). `runtime.ts` 1190 → 1195 lines — flat, because this commit *moves* state
rather than deleting it; the reduction lands in the next one.

## What moved

```ts
export class PmStateHost {
  private editorState: EditorState;
  private hooks: ViewHooks | null = null;
  private viewAttached = false;
```

`model/pm-state.ts` owns the live `EditorState`, the `dispatch` pipeline every transaction flows
through, and the attached view's hooks. It imports nothing but `prosemirror-state` and
`prosemirror-model` — no documents, no Omega, no inspector. That is the test of whether the
boundary is real rather than asserted.

## The PmHost seam

```ts
export interface PmHost {
  clearInspection(): void;
  refreshPresentation(): void;
  updateSession(): void;
  scheduleSave(): void;
}
```

Four members, declared in **the order `dispatch` fires them**, so the interface doubles as the
pipeline's table of contents. `DocumentRuntime implements SyncHost, IndentHost, PmHost` — the
compiler now checks all three boundaries.

## Two rules that were spread across call sites

**`refreshSession()`.** `if (this.attached) this.updateSession()` appeared verbatim at **eight**
sites in `runtime.ts`. The rule it encodes — *a detached runtime keeps syncing but publishes
nothing* — now lives in one method next to the flag it reads, instead of depending on eight sites
remembering it.

**`detach()` returns a boolean.**

```ts
detach(): boolean {
  this.hooks = null;
  if (!this.viewAttached) return false;
  this.viewAttached = false;
  return true;
}
```

The runtime publishes to two global stores and must release them only if it was the one holding
them — a detach on a runtime that never attached would clear a *different* tab's session. The
`attached` flag is gone from the runtime entirely; the answer comes back from the call that knows.

**`scheduleSave()`.** `setInfo({ save: 'pending' })` + `sync.scheduleFlush()` appeared at three
sites and is now the `PmHost` member of the same name, reused by `commitOverlayEdit`.

## applySilently — a stated escape hatch

`refreshPresentation` runs *inside* `dispatch` and produces its own transaction; sending that back
through `dispatch` would recurse forever. It gets `pm.applySilently(tr)`, whose doc comment names
the only legitimate caller. An escape hatch without a stated reason is an invitation, and this one
was previously just `this.state = this.state.apply(transaction)` sitting in the middle of a method.

## What deliberately stayed

`state` and `dispatch` remain public getters on `DocumentRuntime`, delegating to the host, because
`DocumentStage` hands them to its `EditorView`. The stage is a view of a *document*, not of the
runtime's internal decomposition — pushing `runtime.pm.state` across that seam would leak the model
split into the view for no gain.

## runtime.ts.md rewritten

The companion was a 1696-line byte-for-byte mirror of a file that is now 1195 lines and shrinking,
and it had already drifted — its import block still listed `appendChanges`, `createDocument`, and
`diffDoc`, which moved to `model/sync.ts` two commits ago. It is now prose in the current practice
(orientation §5): a table pointing at the six `model/*` companions, then the wiring, seams, and
projection that actually remain here.

## Verification

`pnpm check` 0 errors / 0 warnings · 315 unit tests green · companions fresh ·
`e2e/document-inspector.spec.ts` + `e2e/smoke.spec.ts` **6/6 against real Omega**. The e2e matters
more than usual here: this commit rewrites the path every keystroke takes, and the inspector spec
exercises Backspace-outdent, run line spacing, selection hold across an inspector focus, and the
code-block lens — four different entry points into `dispatch`.
