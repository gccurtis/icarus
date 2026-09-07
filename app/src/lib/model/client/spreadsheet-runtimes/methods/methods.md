# Spreadsheet Runtime Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Two surfaces sit in
front of these — the register and one runtime — and every file here is a free
function taking one of them.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `attach` | file | [`attach.ts`](attach.ts) | mutator | Open a sheet, or hand back the one already open, and read it |
| `sync` | file | [`sync.ts`](sync.ts) | mutator | Re-read the leader, and only while nothing of this runtime's own is outstanding |
| `release` | file | [`release.ts`](release.ts) | mutator | Detach one sheet and return it to be submitted |
| `releaseAll` | file | [`release-all.ts`](release-all.ts) | mutator | Detach every open sheet |
| `apply` | file | [`apply.ts`](apply.ts) | mutator | Apply a gesture to the live sheet, buffer it and record it; `buffer` does the first two without the third |
| `flush` | directory | [`flush/`](flush/flush.md) | mutator | Submit the buffer as one change set |
| `history` | directory | [`history/`](history/history.md) | mutator | The undo and redo stacks |

## Shape

`flush` and `history` are directories because each owns supporting flow —
coalescing and rebasing behind one, inversion behind the other. The rest are
files while one file tells the truth about them.

## State Access

| Takes | Methods | Holds |
| --- | --- | --- |
| `SpreadsheetRuntimesState` | `attach`, `release`, `releaseAll` | The two maps, and the thresholds |
| `Runtime` | `sync`, `apply`, `flush`, `history` | One sheet, its buffer, revision and stacks |

Both are declared in [`definition.svelte.ts`](../definition.svelte.ts) and
imported here as **types only**, which is what keeps the definition's import of
these files from being a cycle.

**No method constructs a `Runtime`.** `$state` compiles only in a `.svelte.ts`,
so minting a reactive record is the one step that cannot be a plain function;
`SpreadsheetRuntimesState.createRuntime` is the factory.

## The register is keyed by sheet id

There is nothing to build a key out of. One object holds sheets only, so the id
*is* the key.

## Shared Methods

One, preserving an invariant that spans its callers — see
[`shared/shared.md`](shared/shared.md).

| File | Callers | Invariant |
| --- | --- | --- |
| `detach.ts` | `release`, `release-all` | A runtime leaves `open` before anything else happens to it |

## Common Shape

Every method here is synchronous except `flush` and `sync`, and the rule
underneath is one sentence: **nothing a user gesture triggers is awaited, and
nothing awaited is triggered by a user gesture.** `attach` fires a read and hands
back the runtime without waiting for it, which is what keeps opening a tab
synchronous while the sheet it shows still catches up.

```text
1. Read what is there — a map entry, or a stack's last entry
2. Compute the next value — through the shared applier when it is the sheet
3. Assign it, and return what the caller needs to compose the next step
```

## Composition is the definition's

`Runtime.apply` calls `apply` and then schedules; `Runtime.undo` calls `history`
and then buffers; `SpreadsheetRuntimes.release` calls `release` and then settles
what it got back. `history` returns ops rather than buffering them and `release`
returns a runtime rather than flushing it, because undo buffers *without
recording* and only the composition point knows that.

`sync` is the one sibling other methods import. `attach` reads on open and
`flush` reads after a landing, and both are the same read.

## Concurrency

**Two flushes never overlap.** The second joins the first through
`runtime.pendingFlush`.

**Ops applied mid-flush are safe.** The buffer is taken and cleared before the
call.

**A failed submit puts its ops back at the front**, ahead of whatever was typed
meanwhile. They happened first.

**A read never lands on work in progress.** `sync` checks the buffer before it
asks and again after the answer arrives.
