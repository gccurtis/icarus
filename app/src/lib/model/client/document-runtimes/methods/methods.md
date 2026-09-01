# Document Runtime Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Two surfaces sit in
front of these — the register and one runtime — and every file here is a free
function taking one of them.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `attach` | file | [`attach.ts`](attach.ts) | mutator | Open a document, or hand back the one already open |
| `release` | file | [`release.ts`](release.ts) | mutator | Detach one document and return it to be submitted |
| `releaseAll` | file | [`release-all.ts`](release-all.ts) | mutator | Detach every open document |
| `apply` | file | [`apply.ts`](apply.ts) | mutator | Buffer a gesture and record it; `buffer` does the first without the second |
| `flush` | directory | [`flush/`](flush/flush.md) | mutator | Submit the buffer as one change set |
| `history` | directory | [`history/`](history/history.md) | mutator | The undo and redo stacks |

## Shape

`flush` and `history` are directories because each owns supporting flow —
coalescing and rebasing behind one, inversion behind the other. The rest are
files while one file tells the truth about them.

## State Access

Two states, and which one a method takes says what it acts on.

| Takes | Methods | Holds |
| --- | --- | --- |
| `DocumentRuntimesState` | `attach`, `release`, `releaseAll` | The two maps, and the thresholds |
| `Runtime` | `apply`, `flush`, `history` | One document's body, buffer, revision and stacks |

Both are declared in [`definition.svelte.ts`](../definition.svelte.ts) and
imported here as **types only**, which is what keeps the definition's import of
these files from being a cycle.

**No method constructs a `Runtime`.** `$state` compiles only in a `.svelte.ts`,
so minting a reactive record is the one step that cannot be a plain function;
`DocumentRuntimesState.createRuntime` is the factory. `attach` calls it and never
sees the class.

## The register is keyed by document id

There is nothing to build a key out of. One object holds documents only, so the
id *is* the key — which is what a per-resource register buys over a generic one
that had to prefix every id with a resource type and share a helper between
`attach` and `release` to keep the two spellings identical.

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

Composition is the definition's, and there is no exception in this object.
`Runtime.apply` calls `apply` and then schedules; `Runtime.undo` calls `history`
and then buffers; `DocumentRuntimes.release` calls `release` and then settles
what it got back.

That is why `history` returns ops rather than buffering them, and why `release`
returns a runtime rather than flushing it. Both would otherwise have to import a
sibling, which the ownership rule refuses — and the shape it forces is the better
one anyway, because undo buffers *without recording* and only the composition
point knows that.

## Concurrency

One thing here is asynchronous, and everything about overlapping work is about
it.

**Two flushes never overlap.** The second joins the first through
`runtime.pendingFlush` — both thresholds can fire together, and `release`
flushes a runtime that may already be submitting.

**Ops applied mid-flush are safe.** The buffer is taken and cleared before the
call, so anything arriving while it is in flight accumulates for the next submit.

**A failed submit puts its ops back at the front**, ahead of whatever was typed
meanwhile. They happened first.
