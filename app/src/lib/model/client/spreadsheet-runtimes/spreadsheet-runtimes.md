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
runtime.body            // the whole current sheet. Reactive. No call, no await.
runtime.apply(ops)      // hand over what the user just did. Returns nothing.
```

**Reading is a property.** `body` is `$state`, so when the server accepts a
change — yours or somebody else's — it changes and whatever read it re-renders.

**Writing is one method.** The editor translates a cell edit into
`SpreadsheetOp[]` and hands them over. Buffering, coalescing, submitting and
refusal are this object's, and none of them is the editor's problem.

`sync` is neither. It is a status for the strip at the bottom of the frame, kept
separate from `body` so a save completing does not re-render a sheet.

## Ownership Boundary

Spreadsheet runtimes own:

- One runtime per open sheet, keyed by **sheet** and never by tab
- Every unsent op, and the submit protocol that gets it to the server
- The undo and redo stacks
- The base revision each buffered op is authored against

Consumers own:

- **Lifetime.** The workbench decides when a sheet opens and closes
- **Translation.** An editor turns a cell edit into ops, and renders `body`
- **What a path means.** The server walks it; this object carries envelopes
- **Recalculation.** A formula is a value in the body, and evaluating it is not
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
| `configuration` | BORROWED | Two thresholds read at construction; not held afterwards |

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
- **Browser-only through timers.** `setTimeout` is the debounce, and it is the
  one browser API this object touches.

## Invariants

- **One runtime per sheet, never per tab.**
- **A runtime exists only while a tab references it.**
- **`body` is the single source of truth for what is rendered.**
- **Unacknowledged writes never leave this object.**
- **Release submits.**
- **The runtime never parses an op path.**
- **Coalescing never touches history.**

## What is forward-declared

Nothing serves a materialized sheet body yet, and nothing writes
`spreadsheetChangeSets`. Two calls are therefore written as comments, with the
code we expect to run:

| Where | Call | What happens meanwhile |
| --- | --- | --- |
| `methods/attach.ts` | read one sheet's body and revision | A runtime opens in `loading` with no body |
| `methods/flush/flush.ts` | append to `spreadsheetChangeSets` | The accepted branch is taken locally |

**The client never holds a snapshot.** It holds one body at one revision.
`spreadsheetSnapshots` is the server's replay anchor and appears nowhere here.

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

**No method imports a sibling.** Composition is the definition's.
