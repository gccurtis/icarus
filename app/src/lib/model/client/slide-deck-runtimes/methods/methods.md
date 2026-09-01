# Slide Deck Runtime Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Two surfaces sit in
front of these — the register and one runtime — and every file here is a free
function taking one of them.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `attach` | file | [`attach.ts`](attach.ts) | mutator | Open a deck, or hand back the one already open |
| `release` | file | [`release.ts`](release.ts) | mutator | Detach one deck and return it to be submitted |
| `releaseAll` | file | [`release-all.ts`](release-all.ts) | mutator | Detach every open deck |
| `apply` | file | [`apply.ts`](apply.ts) | mutator | Buffer a gesture and record it; `buffer` does the first without the second |
| `flush` | directory | [`flush/`](flush/flush.md) | mutator | Submit the buffer as one change set |
| `history` | directory | [`history/`](history/history.md) | mutator | The undo and redo stacks |

## Shape

`flush` and `history` are directories because each owns supporting flow —
coalescing and rebasing behind one, inversion behind the other. The rest are
files while one file tells the truth about them.

## State Access

| Takes | Methods | Holds |
| --- | --- | --- |
| `SlideDeckRuntimesState` | `attach`, `release`, `releaseAll` | The two maps, and the thresholds |
| `Runtime` | `apply`, `flush`, `history` | One deck's body, buffer, revision and stacks |

Both are declared in [`definition.svelte.ts`](../definition.svelte.ts) and
imported here as **types only**, which is what keeps the definition's import of
these files from being a cycle.

**No method constructs a `Runtime`.** `$state` compiles only in a `.svelte.ts`,
so minting a reactive record is the one step that cannot be a plain function;
`SlideDeckRuntimesState.createRuntime` is the factory.

## The register is keyed by deck id

There is nothing to build a key out of. One object holds decks only, so the id
*is* the key.

## Shared Methods

One, preserving an invariant that spans its callers — see
[`shared/shared.md`](shared/shared.md).

| File | Callers | Invariant |
| --- | --- | --- |
| `detach.ts` | `release`, `release-all` | A runtime leaves `open` before anything else happens to it |

## Common Shape

Every method here is synchronous except `flush`, and the rule underneath is one
sentence: **nothing a user gesture triggers is awaited, and nothing awaited is
triggered by a user gesture.**

```text
1. Read what is there — a map entry, or a stack's last entry
2. Compute the next value, without resolving a path or reading a body
3. Assign it, and return what the caller needs to compose the next step
```

## No method calls another

Composition is the definition's. `Runtime.apply` calls `apply` and then
schedules; `Runtime.undo` calls `history` and then buffers; `SlideDeckRuntimes.release`
calls `release` and then settles what it got back.

## Concurrency

**Two flushes never overlap.** The second joins the first through
`runtime.pendingFlush`.

**Ops applied mid-flush are safe.** The buffer is taken and cleared before the
call.

**A failed submit puts its ops back at the front**, ahead of whatever was typed
meanwhile. They happened first.
