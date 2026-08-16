# Method: `open`

Lives at `methods/open/open.md`.

The single way a tab enters this workbench. A click on a resource calls it, and
so does restoration at construction — which is the reason this method has a
directory. Restoring by any other path would have to reimplement the dedupe, and
a second implementation of "is this resource already open" is how a workbench
ends up with two tabs on one document.

Use `activate` instead when the tab is already known by id. `open` is for
reaching a *resource*, and it treats already-open as success rather than as a
condition the caller has to check first.

## Classification

- **Effect:** mutator
- **Entry:** [`open.ts`](open.ts)
- **Exposed as:** `workbench.open()` on `WorkbenchModel`
- **Synchronous:** yes

## Signature

```ts
export const open = (state: WorkbenchState, resource: ResourceRef): Tab => ...;
```

State arrives as a parameter from the definition. Nothing here is read from
module scope, so two instances of `WorkbenchModel` cannot interfere — including
their id counters, which is what makes an id reproducible from a fresh boot.

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `resource` | `ResourceRef` | Kind and id together. The id alone is not unique across kinds, so both are matched |

## Output

`Tab`

The tab now holding that resource, whether it was created or already open. It is
always the active tab afterwards. The returned object is the live one — its
`options` are assigned through `assignOptions`, and a caller mutating it directly
bypasses the persistence rule that method owns.

## Failures

None. An already-open resource is a success, and a `ResourceRef` is checked by
the compiler. Restoration's failure cases belong to `restore`, which drops what
it cannot admit rather than reporting it: a stored kind that no longer exists is
drift, not a defect.

## Effects

- Appends to `state.tabs` when the resource was not open.
- Assigns `state.activeId`.
- Mints an id from the instance counter.
- Persists.

## Concurrency

Synchronous and indivisible. Restoration calls it in a loop during construction,
so the store is written several times in one burst — storage coalesces those into
a single serialization, and the last document is the complete one.

## Method Tree

```text
open(state, resource)
├── state.tabs.find()                         open.ts
|| the resource is already open
│   └── state.activeId = existing.id          open.ts
|| it is not
│   ├── state.nextId()                        ../../definition.svelte.ts
│   └── state.tabs.push(tab)                  open.ts
├── persist()                                 ../shared/persist.ts
└── the tab now holding the resource

restore(state)                                restore/restore.ts
├── state.storage.workbench                   restore/restore.ts
├── isResourceKind()                          ../../types.ts
├── open()                                    open.ts
├── storedOptions()                           restore/stored-options.ts
│   └── isContextId()                         ../../types.ts
├── assignOptions()                           ../shared/assign-options.ts
└── state.activeId = the matched stored ref   restore/restore.ts
```

## Supporting Methods

| Method | Responsibility | File |
| ------ | -------------- | ---- |
| `restore` | Replays a stored workbench through `open`, at construction | [restore/restore.ts](restore/restore.ts) |
| `storedOptions` | Turns one stored tab's options into options this build recognises | [restore/stored-options.ts](restore/stored-options.ts) |

`restore` is a directory because it has support of its own. It carries no
document — this tree already names every path in it.

Restoring is deliberately the same code path as opening:

- `open` already dedupes on kind and id, so a stored duplicate of the permanent
  tab collapses into it rather than appearing twice.
- Ids are minted fresh. A stored id would be meaningless on this boot, and a
  restored `tab-1` colliding with one the counter is about to mint would make
  lookups return the wrong tab.
- The permanent tab is reconstructed by the definition, so it cannot arrive
  wrong; only the options it remembers come from the store.

The active tab is restored as a **ref, not an index**, so a dropped tab cannot
silently activate its neighbour. A ref matching nothing leaves whatever the last
`open` activated, which is always valid.

## Shared Methods Used

| Method | Why this method needs it |
| ------ | ------------------------ |
| `persist` | A tab list that is not in the store is a tab list one reload away from being wrong |
| `assignOptions` | Restored options take the same path as a live one, so the persistence rule is not decided twice |
