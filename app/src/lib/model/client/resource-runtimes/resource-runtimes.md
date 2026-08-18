# Resource Runtimes

Lives at the object root as `resource-runtimes.md`. It is the entry point: a
reviewer reads this, then follows the file tree into the document that answers
their question.

## Description

Resource runtimes keep documents, slide decks and spreadsheets in sync while
somebody edits them. Companion to the [workbench](../workbench/workbench.md),
which owns what is *open* while this owns what is being *changed*.

Two members carry the whole design:

```ts
runtime.body            // the whole current resource. Reactive. No call, no await.
runtime.apply(ops)      // hand over what the user just did. Returns nothing.
```

**Reading is a property.** `body` is `$state`, so when the server accepts a
change — yours or somebody else's — it changes and whatever read it re-renders.

**Writing is one method.** The editor translates its own library's transaction
into `Op[]` and hands them over. Buffering, coalescing, submitting and refusal
are this object's, and none of them is the editor's problem.

`sync` is neither. It is a status for the strip at the bottom of the frame, kept
separate from `body` so a save completing does not re-render a document.

## Ownership Boundary

Resource runtimes own:

- One runtime per open resource, keyed by **resource** and never by tab
- Every unsent op, and the submit protocol that gets it to the server
- The undo and redo stacks
- The base revision each buffered op is authored against

Consumers own:

- **Lifetime.** The workbench decides when a resource opens and closes
- **Translation.** An editor turns its library's transactions into ops, and
  renders `body`; no editor type crosses into this object and no runtime type
  crosses into the workbench
- **What a path means.** The server walks it; this object carries envelopes

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, in `constructor.ts`
- **Released by:** the layout that initialized the model, through
  `ClientModel.close()` in `$effect` cleanup

An *entry* lives from the first tab that opens a resource to the last one that
closes it — the same relationship a `Tab` has to the workbench.

## Public Methods

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `attach` | file | mutator | Open a resource, or hand back the one already open. Idempotent, never throws | [`methods/methods.md`](methods/methods.md) |
| `release` | file | mutator | Submit what is buffered, drop the subscription, detach. A key with no runtime is a no-op | [`methods/methods.md`](methods/methods.md) |
| `releaseAll` | file | mutator | The same, for every open resource | [`methods/methods.md`](methods/methods.md) |

A `ResourceRuntime` — what `attach` returns — offers `apply`, `flush`, `undo`
and `redo` over one resource. See [`methods/methods.md`](methods/methods.md).

**Exactly one method is asynchronous.** `flush`, and only because a caller
sometimes needs to know a write landed: leaving the page, or a deliberate save.
The rule underneath is that **nothing a user gesture triggers is awaited, and
nothing awaited is triggered by a user gesture** — a slow or failed write becomes
a status in the strip rather than a spinner on a click.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `open` | `readonly RuntimeKey[]` | Every resource with a live runtime |
| `flushing` | `readonly RuntimeKey[]` | Those whose last submit has not settled |

Both are projections. The maps behind them are private, because a caller that
could reach into one could hold a runtime past its release.

## Construction

```ts
export const createResourceRuntimes = (configuration: ConfigurationModel): ResourceRuntimesModel => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `configuration` | BORROWED | Two thresholds read at construction; not held afterwards |

The thresholds are read **here rather than at flush time**, so a key missing from
the published list fails while the graph is being built — naming the key and the
file — instead of the first time somebody types.

Nothing else is depended on. It does not know about tabs, and it does not need
storage: nothing it holds survives a reload, by design, because an unflushed
buffer that outlived the browser would be an edit the user can neither see nor
cancel.

## Terminal Behaviour

- **Terminal operation:** `releaseAll`, run by `ClientModel.close()`
- **Releases, in this order:** for each open runtime — leave `open`, cancel the
  debounce, drop the subscription, then submit
- **After release:** `attach` on the same resource opens a fresh runtime, unless
  the old one is still settling, in which case it is revived

**Release submits.** Disposal is never a silent discard. A released runtime moves
to `settling` and is deleted when its submit finishes, which is why `flushing`
can name a key that `open` no longer does.

**A rejected or never-settling submit stays.** It keeps its buffer and reports
`error` or `needs-review`. A runtime that could not send the user's last edits is
work disappearing, and dropping it quietly is the one outcome with no recovery.

**Exactly-once falls out of the data.** `release` looks in `open` and moves the
entry out first, so a second release finds nothing. There is no released-set to
maintain, because the map is the record.

## Concurrency and SSR

- **Two flushes never overlap.** The second joins the first through
  `pendingFlush`. Both thresholds can fire together, and `release` flushes a
  runtime that may already be submitting; two submits carrying half a buffer each
  against one base revision would have the second refused for a conflict it
  created itself.
- **Ops applied mid-flush are safe.** The buffer is taken and cleared before the
  call, so anything arriving while it is in flight accumulates for the next one.
- **A failed submit puts its ops back at the front**, ahead of whatever was typed
  meanwhile.
- **Browser-only through timers.** `setTimeout` is the debounce, and it is the
  one browser API this object touches. It is cancelled on release and on every
  flush, so nothing outlives the instance.

## Invariants

- **One runtime per resource, never per tab.** Two views of one document share a
  buffer, which is the only way both can be correct.
- **A runtime exists only while a tab references it.** None outlives the last tab
  on its resource.
- **`body` is the single source of truth for what is rendered.** No method
  returns a body.
- **Unacknowledged writes never leave this object.** Not into view state, not
  into storage, not into a component.
- **Release submits.**
- **The runtime never parses an op path.** It compares paths as strings when
  coalescing and never resolves one.
- **Coalescing never touches history.** The buffer is the wire's view; the undo
  stack keeps one entry per gesture.

## What is forward-declared

The `revisions` capability ships its
[vocabulary](../../../capabilities/revisions/overview.md) today and its tables
later. Two calls are therefore written as comments, with the code we expect to
run:

| Where | Call | What happens meanwhile |
| --- | --- | --- |
| `methods/attach.ts` | `revisions.read` | A runtime opens in `loading` with no body, which is what an undelivered subscription looks like |
| `methods/flush/flush.ts` | `revisions.submit` | The accepted branch is taken locally, so every state transition around it is the real one |

Everything else is live and tested: buffering, coalescing, the flush schedule,
inversion, the undo and redo stacks, the register's idempotence, revival from
`settling`, release-as-flush, and both projections.

`BodyFor<T>` is the one type stub. The three body types belong to `documents`,
`slideDecks` and `spreadsheets`, none of which exists; nothing here reads a body,
so they resolve to `unknown` until those capabilities land.

## File Tree

```text
resource-runtimes/
├── resource-runtimes.md
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
│       ├── runtime-key.ts
│       └── detach.ts
└── test/
    ├── unit/
    └── non-functional/
```

**Why the definition holds three classes.** `Runtime` is the record and the thin
surface over it; `ResourceRuntimesState` holds the two maps;
`ResourceRuntimes` is the register's surface. All three are here for one reason:
`$state` compiles only in a `.svelte.ts`, and everything else — every verb —
is a free function in `methods/` taking one of them.

`Runtime` declares runes and `ResourceRuntimes` does not, exactly as
`WorkbenchState` does and `Workbench` does not. Reactivity propagates through
getters without the reading class declaring anything.

**No method imports a sibling.** Composition is the definition's: `Runtime.apply`
calls `apply` then schedules, `Runtime.undo` calls `history` then buffers, and
`ResourceRuntimes.release` calls `release` then settles what it got back. That is
why `history` returns ops rather than buffering them — and the shape it forces is
the better one, because undo buffers *without recording* and only the composition
point knows that.
