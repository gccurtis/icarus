# sync.ts

The **SYNC ENGINE** — server truth and the change pipeline. Fourth extraction of workstream C,
and the one the plan sequenced immediately before the actions for a concrete reason: it collapses
eight scattered runtime fields into a single collaborator, which is what makes the actions'
coupling surface tractable.

## What it owns

```ts
export class SyncEngine {
  docId = '';
  revision = 0;
  snapshot: Row[] = [];
  meta = { createdAt: '', updatedAt: '', creatorId: '', creatorName: '' };
  pageLayout: PageLayout = { ...defaultPageLayout };
  layoutRules: LayoutRules = { ...defaultLayoutRules };
  styleRegistry: StyleRegistry = { definitions: [], defaults: [] };
  defaultTypography: CustomTypography | null = null;
  supportsCanonicalLayout = false;
```

Everything Omega is authoritative about, plus the loop that keeps it in step with the editor:
`load`, `scheduleFlush`/`flushNow`/`flush`, `reload`, the retry timer, and the
`inflight`/`queued` serialization. The runtime reads these through `this.sync.*` rather than
holding a second copy — before this, a stale duplicate was always one refactor away.

`adopt(full)` is the one place a full Omega document becomes server truth, shared by `load` and
`reload`, so the two cannot drift in what they refresh.

## The SyncHost seam

```ts
export interface SyncHost {
  doc(): PmNode;
  replaceState(full: Doc): void;
  applyFixups(fixups: Map<number, { blockId: string; rowId: string }>): void;
  captureSelection(): CaretAnchor | null;
  restoreSelection(anchor: CaretAnchor | null): void;
  setInfo(patch: { … }): void;
  savePending(): boolean;
  refreshView(): void;
  onLoaded(): void;
}
```

**The engine never touches an `EditorState`.** It asks for the document to diff, hands back a
full document to rebuild from, and reports status. `DocumentRuntime implements SyncHost`, so the
compiler checks the boundary rather than a comment asserting it.

Nine members, all of them things only the editor half can do — compare that to the ~570-line
actions object's 31, which is why the actions were left for later.

## The two kinds of 409 (a real bug, fixed 2026-07-27)

Omega answers **409 for two unrelated things**, and conflating them cost real data:

- a genuine **revision conflict** — our ops no longer match the server document;
- the **`requireProject` gate** (`{"error":"select a project first"}`), which fires *before* the
  handler runs, so nothing was applied.

`flush` treated every 409 as the first kind: it settled the queued extras (discarding those ops)
and called `reload()`, which rebuilds the editor from server truth. That threw away unsaved edits
and **collapsed the user's selection** — `restoreSelection` can only put back a caret, not a range —
for a condition that just needed the project re-selected.

```ts
const changeSet = await withProject(this.projectId, () =>
  appendChanges(this.docId, this.revision, ops)
);
```

`withProject` selects the project and retries once. A 409 that *survives* that is the real one, and
the existing catch handles it unchanged. `reload` is wrapped the same way, for the same reason.
`load` already was — the write path was the only project-scoped document call that was not.

Pinned by `sync.test.ts`: a gate 409 must retry and must **not** reload; a surviving 409 must
reload; a non-409 must retry later instead. Without the wrapper, two of those three fail.

This also explains an e2e symptom that looked like flakiness: a spec would select text, and the
selection would vanish mid-test whenever a debounced flush happened to land on a stale session cell.

## flush — the part worth reading carefully

```ts
const extras = this.overlay.pendingOps();
const { ops: diffOps, nextRows, fixups } = diffDoc(this.snapshot, this.host.doc());
if (fixups.size > 0) this.host.applyFixups(fixups);
const ops = [...extras, ...diffOps];
```

Two write paths converge here (catalog **B3**). Direct "extra" ops queued by the inspector go
**ahead of** the differ's ops, because a style definition must exist before the op that
references it and a block op must land before content edits that could re-key the block. That
ordering is load-bearing and is now stated where it is relied on. `pendingOps()` returns a copy
so `settle` cannot strip an op queued while the append was in flight.

```ts
this.overlay.settle(extras);
this.snapshot = this.overlay.applyTo(nextRows);
```

The differ carries each block's *previous* style forward (`{ ...previousBlock }`), so the
overlay's block styles are folded into the adopted snapshot explicitly — the step that used to
happen by accident via mutating the snapshot in place (**B2**).

A **409** means the server document has moved under us: the sent extras are settled and `reload`
rebuilds from truth. Any other error sets `save: 'error'` and retries in 4 s. `inflight`/`queued`
guarantee one append at a time with at most one follow-up coalesced behind it.

## What is deliberately not here

No presentation, no selection, no session publishing — those are the host's `refreshView()`.
Keeping them out is what lets `flush` be read as a single story about ops and revisions.
