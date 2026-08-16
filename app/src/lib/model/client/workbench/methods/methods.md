# Workbench Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

This is a list of **methods**, not a mirror of anything. Each entry is here
because `WorkbenchModel` means to offer it.

Three objects folded in here, which is why the list is long enough to need a
directory at all. The context rail, the inspector, and panel geometry all read
and wrote the active tab; being separate objects only meant each was handed a
workbench at construction.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `open` | directory | [`open/`](open/open.md) | mutator | Opens a resource, or activates the tab already holding it |
| `close` | file | [`close.ts`](close.ts) | mutator | Removes a transient tab and chooses the next active one |
| `activate` | file | [`activate.ts`](activate.ts) | mutator | Makes a tab the active one |
| `reorder` | file | [`reorder.ts`](reorder.ts) | mutator | Moves a transient tab among the transient tabs |
| `update` | file | [`update.ts`](update.ts) | mutator | Patches any tab's options by id |
| `availableContexts` | file | [`available-contexts.ts`](available-contexts.ts) | accessor | The rail positions the active tab's kind offers |
| `activeContext` | file | [`active-context.ts`](active-context.ts) | accessor | The active tab's rail position, or its kind's default |
| `selectContext` | file | [`select-context.ts`](select-context.ts) | mutator | Records a rail choice on the active tab |
| `currentInspection` | file | [`current-inspection.ts`](current-inspection.ts) | accessor | The innermost node of the active tab's inspection |
| `inspect` | file | [`inspect.ts`](inspect.ts) | mutator | Replaces the active tab's inspection |
| `panels` | file | [`panels.ts`](panels.ts) | accessor | The active tab's geometry, or `DEFAULTS` |
| `resize` | file | [`resize.ts`](resize.ts) | mutator | Records geometry on the active tab |

`tabs`, `activeId`, and `active` are exposed state rather than methods. The first
two are read straight off the instance; the third is
[`shared/active-tab.ts`](shared/active-tab.ts), because several methods need the
same lookup and the same refusal.

## Shape

A method is one file while one file tells the truth about it. It becomes a
directory when it owns supporting flow — then the directory and its entry file
share a name, and the entry's document carries the whole method tree. Nesting
repeats: a supporting method with support of its own becomes a directory too.

`open` is the only directory here. It owns restoration, because a stored tab
enters this workbench by the same path a click takes and the dedupe that makes
that safe belongs to `open` rather than beside it.

## State Access

Methods receive `WorkbenchState` from the definition — the reactive tab list, the
active id, the id counter, and the borrowed storage. They never import it,
because there is nothing at module scope to import: a method that reached for a
module-level value would be shared by every instance of this object.

A method assigns `state.tabs` and `state.activeId` directly. It never assigns
`tab.options` directly — that is
[`shared/assign-options.ts`](shared/assign-options.ts), which owns the line
between what survives a reload and what dies with the tab.

## Shared Methods

Three, all promoted for invariants that span the surface rather than for reuse.
See [`shared/shared.md`](shared/shared.md).

A supporting method used by one public method stays under that method. It moves
to `shared/` when a second public method needs it **and** it preserves an
invariant spanning them. Two call sites wanting the same code is duplication, not
an invariant, and promoting it early hides which method owns the behavior.

Sibling method directories never import one another. `shared/` is the only path
between them, and it is why `restore` takes the same route to `assignOptions`
that `update` does rather than calling its sibling.

## Common Shape

Every mutator resolves the tab it acts on first and refuses when it cannot,
because acting on a tab that is not in this workbench is the one failure that
would otherwise surface somewhere else entirely.

```text
1. resolve the tab — by id, or the active one — and refuse when it is absent
2. refuse when the tab's own rules forbid the change: permanent, or unavailable
3. assign to state, or hand the patch to assignOptions
4. persist, unless nothing that outlives the session changed
```

Accessors stop at step one and read.

## Concurrency

Every method here is synchronous and therefore indivisible: a caller cannot
observe the tab list part-way through a splice, and there is no await after which
state must be re-read.

Storage is the one place a write outlives the call. `saveWorkbench` coalesces
into a microtask, so several methods running in one synchronous burst cost one
serialization and the last document wins — which is the current one, because each
method persists the whole workbench rather than a delta.
