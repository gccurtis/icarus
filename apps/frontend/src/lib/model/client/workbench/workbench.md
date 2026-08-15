# Workbench

## Description

Workbench holds what is open, which tab is active, and everything a tab carries,
so that every zone of the shell reads one coordinating state instead of keeping
its own copy.

The tab strip renders it, the work surface fills from it, and the context and
inspector panels are projections over it. Named for the frame rather than for
tabs, because the tab list is only its most visible part — and because `session`
collided with an authentication session.

## Three objects folded in

`activities` and `inspector` were never objects. Both were pure getters over the
workbench — every value they exposed already lived on the active tab — and being
handed a workbench at construction was the tell. They owned no state, no
identity, no subscription, and no handle.

`preferences` went for a different reason. Panel geometry became per tab, and
those four values were the whole of it. A user sizing the inspector while reading
one document has said something about that document, not about the application.

| Was | Is now |
| --- | --- |
| `activities.available` | `availableActivities` |
| `activities.active` | `activeActivity` |
| `activities.select` | `selectActivity` |
| `inspector.inspection` | `active.options.inspection` |
| `inspector.current` | `currentInspection` |
| `inspector.inspect` | `inspect` |
| `inspector.view` | the view layer's, resolved from `currentInspection.kind` |
| `preferences.panels` | `panels` |
| `preferences.set` | `resize` |

When surface unrelated to what a tab is starts landing here, that is the signal
to split rather than to fold again.

## Ownership Boundary

Workbench owns:

- the tab list and its order, including which tabs are permanent;
- which tab is active;
- everything one tab remembers: its rail position, its inspection, its scroll
  offset, and its panel geometry;
- the id counter that mints tab ids.

Consumers own:

- what a resource kind or an activity id *renders as*. This object exposes stable
  keys; [`views/registries/`](../../../views/registries) resolves them to
  components.
- the bounds of a drag. `resize` records values; the minimum, the maximum, and
  the width below which a drag collapses belong to the panel that enforces it.

## Lifetime

- **Instance:** one per client instance, which is one browser tab on one project
- **Constructed by:** `buildClientModel`, after storage, which it is built over
- **Released by:** nothing — this object holds nothing releasable

## Public Methods

Every method on `WorkbenchModel`. **Shape** records the choice made when the
method was added: a file while one file tells the truth, a directory once it owns
supporting flow.

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `open` | directory | mutator | Opens a resource, or activates the tab already holding it | [open.md](methods/open/open.md) |
| `close` | file | mutator | Removes a transient tab and chooses the next active one | — |
| `activate` | file | mutator | Makes a tab the active one | — |
| `reorder` | file | mutator | Moves a transient tab among the transient tabs | — |
| `update` | file | mutator | Patches any tab's options by id | — |
| `availableActivities` | file | accessor | The rail positions the active tab's kind offers | — |
| `activeActivity` | file | accessor | The active tab's rail position, or its kind's default | — |
| `selectActivity` | file | mutator | Records a rail choice on the active tab | — |
| `currentInspection` | file | accessor | The innermost node of the active tab's inspection | — |
| `inspect` | file | mutator | Replaces the active tab's inspection | — |
| `panels` | file | accessor | The active tab's geometry, or `DEFAULTS` | — |
| `resize` | file | mutator | Records geometry on the active tab | — |

A simple method has no document of its own.
[`methods/methods.md`](methods/methods.md) lists it.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `tabs` | `readonly Tab[]` | Permanent tabs first, then transient ones in user order |
| `activeId` | `readonly TabId` | Never empty: a permanent tab cannot be closed, so one always remains |
| `active` | `readonly Tab` | The tab `activeId` names |

Every field is readonly. Consumers read state and call methods; a writable field
hands this object's invariants to whoever holds a reference, and no method can
promise anything after that.

`Tab.options` is the one mutable-looking value, and it is replaced rather than
mutated by every path that writes it. A consumer assigning it directly bypasses
the rule about what persists.

No field is a Svelte `Component` or a registry of them. This object exposes
stable keys and the view layer resolves them, so the model stays testable without
a DOM.

## Construction

```ts
export const createWorkbench = (over: ClientStorage): WorkbenchModel => ...;
```

Every call returns a fresh object. State lives on the instance — no module-level
value, and in particular no module-level counter.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `storage` | BORROWED | Read once at construction to restore, written on every change that outlives the session |

**BORROWED** means the environment root constructed it and the root releases it;
this object must never close it.

Construction is atomic in the only sense available to it: the permanent tab is
built before anything is restored, so `activeId` names a real tab from the first
statement onward, and a store that cannot be read is an empty one rather than a
failure.

## The id counter is an instance field

It was module scope before this object moved, and it is not user data, so it
reads as harmless — which is exactly why it was the thing most likely to be
carried across untouched. One counter per process mints ids for every client
instance at once, so two users' tabs interleave and an id stops being
reproducible from a fresh boot.

## Panel geometry rides on the tab

`panels` reads `active.options.panels ?? DEFAULTS`. A tab nobody dragged stores
nothing and follows a later change to the defaults, rather than pinning whatever
was current when it opened.

`DEFAULTS` is frozen, and not merely by convention. Spreading it is load-bearing:
assigning it directly would put the frozen constant on the tab, and a later deep
write would either throw or — without the freeze — reach every other tab reading
the same object.

## What is persisted

Tab refs, rail positions, and panel geometry. Not `inspection`, which names block
ids and character offsets in a document that may have changed since, and not
`scrollTop`, for the same reason.

The permanent tab is written too. It is reconstructed rather than restored, but
the geometry a user dragged on it would otherwise be the one panel size in the
application that a reload forgot. Replaying its ref costs nothing, because
`open()` dedupes on kind and id.

**A stored kind is checked before it is trusted.** `ACTIVITIES_BY_KIND` is a
`Record<ResourceKind, …>`, so a kind written by an older build resolves to
`undefined` and throws during paint. `RESOURCE_KINDS` exists as a value for
exactly this — the type is derived from it, so the two cannot drift — and
`isResourceKind` drops what no longer exists. `ACTIVITY_IDS` and `isActivityId`
are the same pair for the rail.

## Terminal Behaviour

None. This object owns nothing releasable. Its one effect outside itself is a
write to borrowed storage, which coalesces into a microtask and is therefore
never left pending at unload.

## Concurrency and SSR

- Every method is synchronous and indivisible. Nothing awaits, so no method
  re-reads state it started from.
- Several methods in one synchronous burst cost one write, because storage
  coalesces and each method persists the whole workbench rather than a delta.
- This object touches no browser API. Its storage does, at construction, which is
  safe only because `/app` exports `ssr = false` — see [`client.md`](../client.md).
- Reads track correctly wherever they happen: the state is `$state`, the surface
  is getters, and a component consuming `workbench.panels` re-renders when the
  active tab's geometry changes or when a different tab becomes active.

## Invariants

- **A permanent tab cannot be closed or reordered.** It is constructed with the
  workbench, which is what makes the next invariant true rather than hoped for.
- **`activeId` is never empty.** Something is always open, so no consumer needs an
  "if nothing is open" branch.
- **Permanent tabs hold the leading positions**, so the transient ones a user can
  drag are always a contiguous run at the end. `reorder`'s index counts transient
  tabs only, and is offset past that prefix.
- **Closing the active tab selects right, then left.** After the splice the
  element now *at* the removed index is the one that was to the right; a
  permanent tab always survives, so this cannot fall through to nothing.
- **`reorder` clamps rather than throwing.** A drag past either end is an ordinary
  gesture, not a caller error.
- **An unknown id is refused.** `close`, `activate`, `reorder`, and `update` throw
  rather than no-op, because a caller holding an id for a tab that is gone has a
  defect that gets harder to find the further it travels.
- **A stored value is drift, not a defect.** Restoration drops what it no longer
  recognises instead of throwing. `selectActivity` throws, because that is a
  caller naming an activity the rail could not have offered.

## File Tree

```text
workbench/
├── workbench.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── activate.ts
│   ├── active-activity.ts
│   ├── available-activities.ts
│   ├── close.ts
│   ├── current-inspection.ts
│   ├── inspect.ts
│   ├── open/
│   ├── panels.ts
│   ├── reorder.ts
│   ├── resize.ts
│   ├── select-activity.ts
│   ├── update.ts
│   └── shared/
└── test/
    └── unit/
```
