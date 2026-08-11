# pm-state.ts

The **PM STATE HOST** — the live ProseMirror state, the transaction pipeline, and the attached
view. The sixth and last of the `model/*` units the reorg plan named in §4, and the one it
sequenced *before* the actions extraction on evidence: the actions object touched `state`,
`dispatch`, and `hooks` 68 times between them, so folding those three into one collaborator is
what makes the actions' coupling surface small enough to move behind a contract.

## What it owns

```ts
export class PmStateHost {
  private editorState: EditorState;
  private hooks: ViewHooks | null = null;
  private viewAttached = false;
```

Three fields that were three separate runtime concerns, held together because they only make
sense together: a transaction changes the state, the state is pushed to the hooks, and whether
anything is published at all depends on `viewAttached`.

It knows nothing about documents, Omega, or the inspector — no imports beyond `prosemirror-state`
and `prosemirror-model`. That is the test of whether the boundary is real.

## The PmHost seam

```ts
export interface PmHost {
  clearInspection(): void;
  refreshPresentation(): void;
  updateSession(): void;
  scheduleSave(): void;
}
```

Four members, declared **in the order `dispatch` fires them** — the interface doubles as the
pipeline's table of contents. `DocumentRuntime implements PmHost`, so the compiler checks the
boundary the same way `SyncHost` does for the sync engine.

## dispatch — the order is the whole point

```ts
if (tr.selectionSet && !tr.getMeta('taurus:keep-inspection')) this.host.clearInspection();
this.editorState = this.editorState.apply(tr);
if (tr.docChanged) this.host.refreshPresentation();
this.pushState();
this.refreshSession();
if (tr.docChanged) {
  this.notifyDocChanged();
  if (!tr.getMeta('taurus:sync')) this.host.scheduleSave();
}
```

Every transaction goes through here — the view's `dispatchTransaction` and every inspector action
alike. The sequence is load-bearing in three places:

- **Presentation before the push.** Decorations are recomputed *before* the state reaches the
  view, so what is painted always matches the document that produced it. There is no frame in
  which the two disagree.
- **`taurus:keep-inspection`.** A transaction that moved the caret deliberately (a gutter click,
  an inspector focus) carries this meta; anything else moving the caret means the user navigated
  away, and the pinned inspection is released.
- **`taurus:sync`.** Marks a transaction the runtime made *from* server truth — id fixups, the
  decoration pass, a restored caret. Scheduling a flush for one of those would echo the server's
  own change straight back at it.

## applySilently — the deliberate hole in the pipeline

```ts
applySilently(tr: Transaction) {
  this.editorState = this.editorState.apply(tr);
}
```

`refreshPresentation` runs *inside* `dispatch` and produces its own transaction. Sending that back
through `dispatch` would recurse forever, so it has a way to apply a transaction without the
reactions. This is the only legitimate caller; the doc comment says so, because an escape hatch
without a stated reason is an invitation.

## detach returns a boolean

```ts
detach(): boolean {
  this.hooks = null;
  if (!this.viewAttached) return false;
  this.viewAttached = false;
  return true;
}
```

The runtime publishes to two global stores (`editorSession`, `activeSurface`) and must release
them only if it was the one holding them. A detach on a runtime that never attached would
otherwise clear a *different* tab's session. The old code kept an `attached` flag on the runtime
for this; returning it from `detach` keeps the flag in one place.

## refreshSession

`if (this.viewAttached) this.host.updateSession()` — the guard that used to be written out at
eight call sites in the runtime, each an `if (this.attached) this.updateSession()`. Naming it puts
the rule ("a detached runtime keeps syncing but publishes nothing") in one place instead of
depending on eight sites remembering it.

## What stays on the runtime

`state` and `dispatch` remain public getters on `DocumentRuntime`, delegating here, because
`DocumentStage` hands them to its `EditorView`. The stage is a view of a *document*, not of the
runtime's internal decomposition — the model split should not be visible across that seam.
