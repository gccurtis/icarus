# Ledger As Built

*Icarus · representation · model/client · capabilities · runtime*

View state became a ledger: a stored row per person, an append-only history
behind it, and every gesture recorded as an operation that knows its own
inverse. Four phases, 93 files, and one surface deliberately unmoved.

| Check | Before | After |
| --- | --- | --- |
| `pnpm lint --all` | 73 findings | 65 |
| `pnpm typecheck` | 170 errors | 170 |
| `pnpm test` | 326 passed · 13 failed | 358 passed · 13 failed |
| `pnpm test:scripts` | 109 / 109 | 111 / 111 |

## 00 — Four categories, in the order they had to happen

Each phase is a precondition for the next. The representation has to exist
before a capability can speak it; the split has to exist before there is a
single writer to log; the log has to exist before there is anything to persist.

```text
01  THE REPRESENTATION   the vocabulary and the stored shapes move
    │                    out of the model and into a views domain
    ▼
02  THE SPLIT            one object becomes three, and the middle
    │                    one becomes the only writer
    ▼
03  THE LOG              every gesture becomes a ViewOp with an
    │                    exact inverse; the reopen queue dissolves
    ▼
04  PERSISTENCE          two tables, two procedures, a debounce —
                         the same shape the three resources use
```

Why the order is forced: `capability-imports` forbids a procedure from reaching
`$model/client/*`, so 04 can only speak types that 01 put in `representation/`.
And a log written by two objects is not a log, so 03 needs 02.

---

## 01 — The representation

What a tab *is* stopped being a model type. The screen and panel vocabularies,
the stored tab shapes, the operation union and its inversion moved into a
`views` domain under `representation/` — because
`representation-imports-nothing-else` forbids that tree from reaching back into
the model, and a stored `TabView` names a `Subscreen`.

```text
representation/data/types/views/          emits nothing
├── screens.ts    Screen, Subscreen           generated
├── panels.ts     ContextId, InspectionKey
├── tab.ts        TabId TabRecord TabView Target
│                 Frame Selection Inspected Landing
└── op.ts         ViewOp

representation/data/behavior/views/       pure, no clock, no globals
├── screens.ts    SCREENS SUBSCREENS isScreen  generated
├── panels.ts     CONTEXT_IDS INSPECTION_KEYS + guards
└── invert.ts     invert(op), invertAll(ops)

model/client/view-state/methods/shared/   stayed behind
├── rails.ts      RAILS railFor defaultContext offersContext
└── defaults.ts   SINGLETONS isSingleton DEFAULT_FRAME
```

The line: representation holds only what a stored row holds. Rails and defaults
say what a tab that does not exist yet *will be*, and no reader of a row
consults either.

### State changes

| What | Before | After |
| --- | --- | --- |
| `Screen`, `Subscreen` | model, one generated file | representation, two generated files |
| `Subscreen` shape | `(typeof SUBSCREENS)[Screen][number]` | a flat union, declared first |
| `ContextId`, `InspectionKey` | one hand-written file | union in `types/`, list + guards in `behavior/`, held together by a compile-time exhaustiveness check |
| Stored nullability | `undefined` throughout | `null` in the row — an absent JSON key and a null are two spellings of one state |
| Store tables | 38 | 40 — `viewSnapshots`, `viewRevisions` |
| The generator | `pnpm view-state-keys`, one file into the model | `pnpm screen-keys`, two files into representation |

**Nothing outside the object imported the vocabulary directly.** Every consumer
already went through `$model/client/view-state`, which kept re-exporting the
same names — so 26 files that read screens, rails and lenses were untouched.

---

## 02 — The split

The seam was already written out six times: every method that touched what a tab
was *showing* opened with `const tab = state.active`, and no list method touched
anything but `activeId`. Two objects came out of that, and the one left in the
middle became the only thing that writes.

```text
   tab-list   ─────►   view-state   ◄─────   tab-views
   what exists         coordinator           what each tab
   the order           the composition       is looking at
   which is active     the only writer       copy on write

   TabRecord[]         Tab = record + view   SvelteMap<TabId, TabView>
   activeId            the log, undo
   the id counter      every decision
```

`tabList` and `tabViews` are the first two model objects that are *not* fields
on `ClientModel`. The runtime builds them, hands them to `createViewState`, and
does not return them — a view that reached `tabList.add(…)` through the graph
would move a tab without leaving a record.

### State changes

| What | Before | After |
| --- | --- | --- |
| Construction | `createViewState(project)` | `createViewState(project, tabs, views, configuration)` |
| `Tab` | a stored record, mutated in place | a composition, built per read by `compose` |
| Reactivity of a view | `$state` deep proxy, edited field by field | `SvelteMap` entry replaced whole on every write |
| Null at the surface | n/a | `compose` turns the row's `null`s back into the `undefined`s every view already narrows against |
| `ClientModel` fields | 9 | 9 — the two new objects are deliberately absent |

**The acceptance test was that nothing happened.** The whole 800-line view-state
suite passed unchanged against the coordinator, and no file under `views/` was
edited in this phase.

---

## 03 — The log

A method no longer writes state. It reads the `was` half off the tab, builds a
`ViewOp`, and hands it to `perform`, which applies it and appends it. Every
member carries both sides of what it changed, so `invert` is a payload swap that
reads no state and undo is an ordinary change rather than a rewind.

### Seven operations, each its own inverse

| Operation | Carries | What it does | Inverted by |
| --- | --- | --- | --- |
| `open` | `tab at target view` | stores a view, inserts a record at an index | `close`, same payload |
| `close` | `tab at target view` | removes both halves | `open`, same payload |
| `activate` | `was now` | moves the cursor | swap `was` ⇄ `now` |
| `land` | `was now` (whole `Landing`) | switches the centre, defaults the rail, clears the lens | swap the whole landing |
| `context` | `was now` | moves the rail | swap `was` ⇄ `now` |
| `inspect` | two `was`/`now` pairs | points the inspector at something | swap both pairs |
| `resize` | `was now` (whole `Frame`) | drags a flank | swap `was` ⇄ `now` |

**One departure from the design.** `open` and `close` no longer move the cursor
— an `activate` op does. Opening is `open` then `activate`; closing the active
tab is `activate` to the neighbour then `close`. Without that, `close` picks a
neighbour it has nothing in the op to restore from, and the tab you were on
before is unrecoverable.

### Behaviour changes

| Gesture | Before | After |
| --- | --- | --- |
| Any mutation | assigns a field on a `Tab` | records a `ViewOp`; one arm of `apply` is the only place it becomes a change |
| Undo | did not exist — only `reopenClosed`, one operation, special-cased | every op, unbounded, plus `redo` |
| Redo | did not exist | until the next gesture drops the stack |
| Reopening a tab | pop a ten-deep array of whole `Tab`s | invert the most recent `close` with no later `open` for that tab — and the reopen is itself recorded |
| The reopen cap | 10, oldest dropped silently | gone — nothing is kept beside the log to be dropped from |
| `closed` on the surface | `readonly Tab[]` | deleted; nothing under `views/` read it |
| Landing undo | n/a | restores all five fields a landing writes |

---

## 04 — Persistence

A `view` capability with two procedures, each opening on `requireScope()` —
which already yields `{ projectId, userId, username }`, so neither takes a key
and neither can be asked for somebody else's row. One writer per row means no
rebase ladder, no conflict, no `needs-review`.

```text
viewSnapshots  one row per (userId, projectId), replaced in place
    projectId  userId  revision  tabs  activeId  views  at

viewRevisions  append only, never rewritten
    projectId  userId  revision  baseRevision  ops  at

readViewState()        the row for this scope, or nothing
submitViewChanges(…)   append a revision, replace the snapshot

    gesture ──► buffer ──► 8 ops or 750ms ──► one change set ──► revision+1
              a refusal puts the ops back at the front and says so
```

The materialization travels with the ops because nothing on the server side
could replay them — applying a `ViewOp` is the client model's, and a second
applier would be a second answer to what an op means.

### New behaviour

| What | How it behaves |
| --- | --- |
| `restore()` | Called by the `/app` layout, not the constructor — the graph is built synchronously so the first paint has the singletons to draw. A row that lands after the person has already acted is dropped rather than applied. |
| `flush()` | Cancels the debounce and submits; two concurrent flushes join one write. `ClientModel.close()` calls it before the three resource registers release. |
| `sync`, `pending`, `revision` | New readable state: `loading` → `saved` / `saving` / `error`, the count of unsent ops, and the revision the server last accepted. |
| A refused submit | Puts its ops back at the front of the buffer and reports `error`. Unsent work is never dropped. |
| Restored tab ids | `tab-list.add` now advances its counter past any id it accepts, so a restored `t7` can never be minted a second time. |
| Zero thresholds | A panel rendering with no provider gets a view state that buffers nothing and submits nothing. |

---

## 05 — The surface, before and after

| Member | Status | Note |
| --- | --- | --- |
| `tabs` `activeId` `active` `frame` `context` `inspected` `selection` | unchanged | Five still read the active tab, so a tab switch changes all of them at once |
| `open` `activate` `close` `reopenClosed` `showSubscreen` `selectContext` `inspect` `clear` `resize` `showing` | unchanged | Same signatures, same refusals, same return types |
| `closed` | removed | The ten-deep queue collapsed into the log |
| `undo` `redo` `canUndo` `canRedo` | added | Two readers of one structure |
| `restore` `flush` `revision` `sync` `pending` | added | The persistence half, shaped like the three resource runtimes |

---

## 06 — Every file

50 new (+2,545 lines) · 38 modified (±955) · 5 deleted (−910) · 2 files touched
under `views/`, both `NAMED_FIELD` maps.

### 01 · Representation

| | File | Lines |
| --- | --- | --- |
| + | `representation/data/types/views/screens.ts` — generated | 25 |
| + | `representation/data/types/views/panels.ts` | 201 |
| + | `representation/data/types/views/tab.ts` | 46 |
| + | `representation/data/types/views/op.ts` | 26 |
| + | `representation/data/behavior/views/screens.ts` — generated | 34 |
| + | `representation/data/behavior/views/panels.ts` | 217 |
| + | `representation/data/behavior/views/invert.ts` | 34 |
| ~ | `representation/store/tables.ts` | 29 |
| ~ | `representation/data/types/types.md` | 5 |
| ~ | `configuration/representation.yaml` | 1 |
| + | `scripts/generation/representation/screens.mjs` | 240 |
| + | `scripts/generation/representation/test/screens.test.mjs` | 376 |
| − | `scripts/generation/view-state/keys.mjs` | 243 |
| − | `scripts/generation/view-state/test/keys.test.mjs` | 349 |
| − | `view-state/methods/shared/keys.ts` | 56 |
| − | `view-state/methods/shared/panel-keys.ts` | 228 |
| ~ | `scripts/lint/shared/keys.mjs` | 13 |
| ~ | `scripts/generation/panels/new-panel.mjs` | 76 |
| ~ | `scripts/generation/workspaces/new-workspace.mjs` | 4 |
| ~ | `scripts/test/generation.test.mjs` | 6 |
| ~ | `package.json` | 2 |
| ~ | `views/tab-bar/procedures/resource-name.ts` | 4 |
| ~ | `views/status-bar/procedures/resource-name.ts` | 4 |

### 02 · The split

| | File | Lines |
| --- | --- | --- |
| + | `model/client/tab-list/tab-list.md` | 123 |
| + | `model/client/tab-list/types.ts` | 15 |
| + | `model/client/tab-list/definition.svelte.ts` | 61 |
| + | `model/client/tab-list/constructor.ts` | 4 |
| + | `model/client/tab-list/index.ts` | 2 |
| + | `model/client/tab-list/methods/methods.md` | 20 |
| + | `model/client/tab-list/methods/mint.ts` | 11 |
| + | `model/client/tab-list/methods/add.ts` | 15 |
| + | `model/client/tab-list/methods/remove.ts` | 10 |
| + | `model/client/tab-list/methods/activate.ts` | 6 |
| + | `model/client/tab-views/tab-views.md` | 132 |
| + | `model/client/tab-views/types.ts` | 24 |
| + | `model/client/tab-views/definition.ts` | 62 |
| + | `model/client/tab-views/constructor.ts` | 4 |
| + | `model/client/tab-views/index.ts` | 2 |
| + | `model/client/tab-views/methods/methods.md` | 17 |
| + | `model/client/tab-views/methods/of.ts` | 8 |
| + | `model/client/tab-views/methods/patch.ts` | 7 |
| + | `view-state/methods/shared/compose.ts` | 14 |
| + | `view-state/methods/shared/defaults.ts` | 20 |
| + | `view-state/methods/shared/mint-view.ts` | 15 |
| − | `view-state/methods/shared/mint-tab.ts` | 34 |
| ~ | `view-state/types.ts` | 165 |
| ~ | `view-state/definition.svelte.ts` | 203 |
| ~ | `view-state/constructor.ts` | 30 |
| ~ | `view-state/index.ts` | 84 |
| ~ | `view-state/methods/shared/land-on.ts` | 74 |
| ~ | `view-state/methods/shared/rails.ts` | 90 |
| ~ | `view-state/methods/shared/target-key.ts` | 21 |
| ~ | `runtime/client/start.ts` | 54 |
| ~ | `runtime/client/types.ts` | 65 |
| ~ | `runtime/client/client.md` | 15 |
| ~ | `src/test/keys-route.test.ts` | 9 |

### 03 · The log

| | File | Lines |
| --- | --- | --- |
| + | `view-state/methods/shared/apply.ts` | 39 |
| + | `view-state/methods/shared/perform.ts` | 19 |
| + | `view-state/methods/shared/landing.ts` | 9 |
| + | `view-state/methods/undo.ts` | 11 |
| + | `view-state/methods/redo.ts` | 11 |
| + | `view-state/test/unit/invert.test.ts` | 86 |
| ~ | `view-state/methods/open.ts` | 63 |
| ~ | `view-state/methods/close.ts` | 47 |
| ~ | `view-state/methods/reopen-closed.ts` | 35 |
| ~ | `view-state/methods/activate.ts` | 15 |
| ~ | `view-state/methods/select-context.ts` | 24 |
| ~ | `view-state/methods/inspect.ts` | 33 |
| ~ | `view-state/methods/clear.ts` | 23 |
| ~ | `view-state/methods/resize.ts` | 19 |
| ~ | `view-state/methods/show-subscreen.ts` | 16 |
| ~ | `view-state/methods/showing.ts` | 17 |
| ~ | `view-state/test/unit/view-state.test.ts` | 145 |
| ~ | `scripts/test/mutations.mjs` | 5 |

### 04 · Persistence

| | File | Lines |
| --- | --- | --- |
| + | `capabilities/view/index.remote.ts` | 13 |
| + | `capabilities/view/view.md` | 3 |
| + | `capabilities/view/types/read-view-state.ts` | 8 |
| + | `capabilities/view/types/submit-view-changes.ts` | 12 |
| + | `capabilities/view/api/read-view-state/read-view-state.ts` | 18 |
| + | `capabilities/view/api/submit-view-changes/submit-view-changes.ts` | 48 |
| + | `capabilities/view/api/submit-view-changes/validate-submit-view-changes.ts` | 31 |
| + | `capabilities/view/test/unit/view.test.ts` | 146 |
| + | `view-state/methods/shared/submit.ts` | 43 |
| + | `view-state/methods/flush.ts` | 4 |
| + | `view-state/methods/restore.ts` | 34 |
| + | `view-state/test/unit/persistence.test.ts` | 221 |
| + | `configuration/views.yaml` | 18 |
| ~ | `routes/app/[project]/+layout.server.ts` | 4 |
| ~ | `routes/app/[project]/+layout.svelte` | 2 |

### Documents

| | File | Lines |
| --- | --- | --- |
| ~ | `view-state/view-state.md` | 205 |
| ~ | `view-state/methods/shared/shared.md` | 225 |
| ~ | `view-state/methods/methods.md` | 62 |

---

## 07 — What did not change, and what is still broken

**Under `views/`, two files.** Both are the `NAMED_FIELD` maps in the tab bar
and the status bar, which are exhaustive over `TableName` and fail to compile
without the two new tables. The other 24 files that read view state — every
workspace, the context panel, the inspector, the app shell — were not touched,
which was the point.

**Thirteen tests still fail, and they are the same thirteen.** Every one is a
workspace that will not render alone, from before this change: `$capabilities/cast`
does not exist, and seven capability procedures are named but not built.

**170 typecheck errors, unchanged.** Fifteen are the copilot, still importing
`$shared/types/resource-set-expression` from a pre-Convex tree; the rest are
`views/workspaces`.

### Two things to fix, not fixed here

`pnpm new-table` writes broken TypeScript when the new name sorts last:
`insertSorted` appends without giving the previous final entry a comma. Fixed by
hand in the file; still present in the generator, and its own test misses it
because `probeThings` sorts into the middle.

`docs/architecture-design/linters-and-generators.md` still names
`view-state-keys`. It is a mirrored artifact, so correcting it means
republishing.

---

Measured on `main`, on top of `efb9c93`. The 93 files land as eight commits. The design this was built against is
[View State Ledger](view-state-ledger.md); this sheet is what was actually put in.
