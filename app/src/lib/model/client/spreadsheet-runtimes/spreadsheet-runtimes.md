# Spreadsheet Runtimes

Lives at the object root as `spreadsheet-runtimes.md`. It is the entry point: a
reviewer reads this, then follows the file tree into the document that answers
their question.

## Description

Spreadsheet runtimes keep sheets in sync while somebody edits them. Companion to
[workspace-state](../workspace-state/workspace-state.md), which owns what is *open* while this
owns what is being *changed*.

Two members carry the whole design:

```ts
runtime.sheet           // the grid and every populated cell. Reactive. No call, no await.
runtime.apply(ops)      // hand over what the user just did. Returns nothing.
```

**Reading is a property.** `sheet` is `$state`, so when the server accepts a
change — yours or somebody else's — it changes and whatever read it re-renders.
It is one value with two halves, `body` for the grid's shape and `cells` keyed
by `rowId/columnId`, because the store keeps them in two tables and the surface
needs them as one.

**Writing is one method.** The editor translates a gesture into
`SpreadsheetOp[]` and hands them over. The ops are applied to `sheet` at once,
with the same function the server will run, and buffered for the wire.
Coalescing, submitting and refusal are this object's, and none of them is the
editor's problem.

`sync` is neither. It is a status for the strip at the bottom of the frame, kept
separate from `sheet` so a save completing does not re-render a grid.

## Ownership Boundary

Spreadsheet runtimes own:

- One runtime per open sheet, keyed by **sheet** and never by tab
- The live sheet, and applying every op to it before it goes anywhere
- Every unsent op, and the submit protocol that gets it to the server
- The undo and redo stacks
- The base revision each buffered op is authored against
- `scrollTo`, the one cell the surface has been asked to bring into view

Consumers own:

- **Lifetime.** The workbench decides when a sheet opens and closes
- **Translation.** An editor turns a gesture into ops, and renders `sheet`
- **What a path means.** The applier walks it; this object carries envelopes
- **Recalculation.** A formula is a value in a cell, and evaluating it is not
  this object's concern

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, in `constructor.ts`
- **Released by:** the layout that initialized the model, through
  `ClientModel.close()` in `$effect` cleanup

An *entry* lives from the first tab that opens a sheet to the last one that
closes it.

## Public Methods

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `attach` | file | mutator | Open a sheet, or hand back the one already open. Idempotent, never throws | [`methods/methods.md`](methods/methods.md) |
| `release` | file | mutator | Submit what is buffered, drop the subscription, detach. An id with no runtime is a no-op | [`methods/methods.md`](methods/methods.md) |
| `releaseAll` | file | mutator | The same, for every open sheet | [`methods/methods.md`](methods/methods.md) |

A `SpreadsheetRuntime` — what `attach` returns — offers `apply`, `flush`, `undo`
and `redo` over one sheet. See [`methods/methods.md`](methods/methods.md).

**Exactly one method is asynchronous.** `flush`, and only because a caller
sometimes needs to know a write landed: leaving the page, or a deliberate save.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `open` | `readonly string[]` | Every sheet with a live runtime |
| `flushing` | `readonly string[]` | Those whose last submit has not settled |

Both are projections of sheet ids. The maps behind them are private, because a
caller that could reach into one could hold a runtime past its release.

## Construction

```ts
export const createSpreadsheetRuntimes = (configuration: ConfigurationModel): SpreadsheetRuntimesModel => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `configuration` | BORROWED | Three thresholds read at construction; not held afterwards |

The thresholds are read **here rather than at flush time**, so a key missing from
the published list fails while the graph is being built.

## Terminal Behaviour

- **Terminal operation:** `releaseAll`, run by `ClientModel.close()`
- **Releases, in this order:** for each open runtime — leave `open`, cancel the
  debounce, drop the subscription, then submit
- **After release:** `attach` on the same sheet opens a fresh runtime, unless the
  old one is still settling, in which case it is revived

**Release submits.** Disposal is never a silent discard. A released runtime moves
to `settling` and is deleted when its submit finishes, which is why `flushing`
can name an id that `open` no longer does.

**A rejected or never-settling submit stays.** It keeps its buffer and reports
`error` or `needs-review`.

## Concurrency and SSR

- **Two flushes never overlap.** The second joins the first through
  `pendingFlush`.
- **Ops applied mid-flush are safe.** The buffer is taken and cleared before the
  call.
- **A failed submit puts its ops back at the front.**
- **Browser-only through timers.** `setTimeout` is the debounce and
  `setInterval` the re-read, and they are the two browser APIs this object
  touches.

## Invariants

- **One runtime per sheet, never per tab.**
- **A runtime exists only while a tab references it.**
- **`sheet` is the single source of truth for what is rendered.**
- **Every op is applied here before it is buffered**, with the applier the
  server shares, so what the person sees is what the server will compute.
- **Unacknowledged writes never leave this object.**
- **Release submits.**
- **The runtime never parses an op path.** The applier does; this object
  compares paths as strings when coalescing.
- **Coalescing never touches history.**

## What crosses to the server

Two calls, both through [`$capabilities/spreadsheet`](../../../capabilities/spreadsheet/spreadsheet.md):

| Where | Call | On failure |
| --- | --- | --- |
| `methods/sync.ts` | `readSpreadsheet` — one sheet's grid, cells and revision | Silence, unless nothing has ever been read: a failed re-read leaves the sheet that is showing alone. A sheet with no leader is not a failure either — it opens on the empty grid, so there is always somewhere to type |
| `methods/flush/flush.ts` | `submitSpreadsheetChanges` — one coalesced change set | A refusal keeps the buffer and reports `needs-review`; a fault keeps it and reports `error` |

**A refusal is not a throw.** The capability answers `accepted: false` with the
revision the leader is actually at, and only a genuine fault rejects. A `stale`
refusal is restated once at that revision; a second refusal, or an `unresolved`
one, reverts to what the server holds and asks a person.

**An acceptance may carry catch-up.** When somebody else's change sets landed on
unrelated paths since this runtime last read, the answer brings their ops, and
they are applied to `sheet` the same way this runtime's own were.

**The client never holds a snapshot.** It holds one sheet at one revision.
`spreadsheetSnapshots` is the server's replay anchor and appears nowhere here.

**A read never overwrites work in progress.** `sync` refuses to run while
anything is buffered or in flight, and checks again after the answer arrives.

## File Tree

```text
spreadsheet-runtimes/
├── spreadsheet-runtimes.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── attach.ts
│   ├── sync.ts
│   ├── release.ts
│   ├── release-all.ts
│   ├── apply.ts
│   ├── flush/
│   │   ├── flush.md
│   │   ├── flush.ts
│   │   ├── coalesce.ts
│   │   └── rebase.ts
│   ├── history/
│   │   ├── history.md
│   │   ├── history.ts
│   │   └── invert.ts
│   └── shared/
│       ├── shared.md
│       └── detach.ts
└── test/
    ├── unit/
    └── non-functional/
```

**Why the definition holds three classes.** `Runtime` is the record and the thin
surface over it; `SpreadsheetRuntimesState` holds the two maps;
`SpreadsheetRuntimes` is the register's surface. All three are here for one
reason: `$state` compiles only in a `.svelte.ts`.

**No method imports a sibling**, with one exception: `attach` and `flush` call
`sync`, because a read after a landing is part of what landing means.
