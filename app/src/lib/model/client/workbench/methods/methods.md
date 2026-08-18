# Workbench Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `open` | directory | [`open/`](open/open.md) | mutator | The tab already on this target, or a fresh one |
| `resolveLauncher` | directory | [`open/`](open/open.md) | mutator | Turn a launcher into what it created |
| `close` | file | [`close.ts`](close.ts) | mutator | Splice, queue, release |
| `closeAll` | file | [`close-all.ts`](close-all.ts) | mutator | Clear to the singletons |
| `activate` | file | [`activate.ts`](activate.ts) | mutator | Move `activeId` |
| `reorder` | file | [`reorder.ts`](reorder.ts) | mutator | Move a closable tab |
| `reopenClosed` | file | [`reopen-closed.ts`](reopen-closed.ts) | mutator | Pop the reopen queue |
| `update` | file | [`update.ts`](update.ts) | mutator | Patch one screen's own state |
| `selectContext` | file | [`select-context.ts`](select-context.ts) | mutator | Record the rail position |
| `inspect` | file | [`inspect.ts`](inspect.ts) | mutator | Replace the inspection key |
| `resize` | file | [`resize.ts`](resize.ts) | mutator | Record frame geometry |
| `inspectedNode` | file | [`inspected-node.ts`](inspected-node.ts) | accessor | The active tab's key |
| `frame` | file | [`frame.ts`](frame.ts) | accessor | The active tab's geometry |
| `runtimeFor` | file | [`runtime-for.ts`](runtime-for.ts) | accessor | A tab's resource runtime |

## Shape

`open` is the only directory, and `resolveLauncher` sits inside it because the
two are one flow: a launcher is a tab a user opened without yet saying what for,
and resolving is where they say. Both end in the same two shared steps.

## State Access

Every method takes `WorkbenchState` as its first argument, imported as a **type**
from [`definition.svelte.ts`](../definition.svelte.ts) — which is what keeps the
definition's import of these files from being a cycle at runtime.

A method never reaches module scope. `nextId` is an instance field on the state
for exactly that reason: one counter per process would mint ids for every client
instance at once.

## Shared Methods

Four, each preserving an invariant that spans its callers — see
[`shared/shared.md`](shared/shared.md).

| File | Invariant |
| --- | --- |
| `target-key.ts` | One target, one key. The whole definition of "already open" |
| `adopt-target.ts` | One mint point, so a tab is never half-built |
| `active-tab.ts` | `activeId` names a real tab, so `active` is non-optional |
| `assign-state.ts` | One write path into view state |

## Common Shape

```text
1. Find the tab, or refuse — a defect for an unknown id, a no-op for an
   ordinary miss
2. Refuse a singleton where the operation cannot apply to one
3. Compute the next value and assign it
4. Keep `activeId` pointing at something real
```

## Concurrency

Nothing here is asynchronous, so no two methods can interleave — every one runs
to completion before the next begins.

`runtime-for` is the exception worth naming: it reaches an object that *is*
asynchronous, but it neither awaits nor stores what it gets. `attach` is
idempotent, so calling it is a lookup, and the runtime's own status is what a
view reads.
