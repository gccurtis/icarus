# Tab List

Lives at the object root as `tab-list.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

Tab list holds **what is open, in what order, and which one is active** — and
nothing about what any of them is showing.

A `TabRecord` is three fields: an id, a category, and the resource the tab is
*for*. All three are readonly, because none of them changes over a tab's life. A
document tab is a document tab from the moment it is minted until it is closed;
everything that moves while it is open lives in
[tab-views](../tab-views/tab-views.md).

**It decides nothing.** There is no default here, no rail, no policy about which
categories may be closed. It is a list with an identity function for ids and a
cursor, and every question of the form "should this be allowed" belongs to
[workspace-state](../workspace-state/workspace-state.md), which is the only object that holds
one of these.

## Ownership Boundary

Tab list owns:

- The order of the strip
- Which tab is active
- The id counter, and therefore the guarantee that no two tabs share an id

Consumers own:

- **What a tab is showing.** That is `tab-views`, keyed by the ids minted here
- **Whether a tab may be closed.** Permanence is a category's property, and
  `workspace-state` is where the refusal lives
- **What happens next.** Removing the active tab leaves `activeId` naming
  nothing; choosing the neighbour is the caller's decision, and this object will
  not invent one

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, immediately before `workspace-state`
- **Released by:** nothing — this object holds nothing releasable

**It is not a field on `ClientModel`.** The runtime builds it, hands it to
`createWorkspaceState`, and does not return it. A view that could reach it through the
graph could move a tab without going through the coordinator, which is the one
thing the coordinator exists to prevent.

## Public Methods

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `mint` | file | mutator | A fresh record for a target. Advances the counter; adds nothing |
| `add` | file | mutator | Put a record in the strip, at an index or at the end. Returns where it landed |
| `remove` | file | mutator | Take one out. Returns the index it was at, or `-1` |
| `activate` | file | mutator | Move the cursor. An id naming no tab is ignored |
| `at` · `find` · `indexOf` | definition | accessor | Three lookups, one line each |

**`mint` does not add.** The two are separate because the caller has a view to
store under the new id before the record becomes visible, and a record in the
strip with no view behind it is a state no reader should have to handle.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `tabs` | `readonly TabRecord[]` | The strip, in its order |
| `activeId` | `readonly TabId` | Which one the cursor is on |
| `active` | `readonly TabRecord` | The record `activeId` names, falling back to the first |

The fallback on `active` is unreachable while a caller keeps at least one tab in
the strip, and it is there so the type is not `TabRecord | undefined` for every
reader — which would be a `?.` guarding a case the coordinator's singletons make
impossible.

## Construction

```ts
export const createTabList = (): TabListModel => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| — | — | None. It borrows no object |

## Terminal Behaviour

None. This object owns nothing releasable.

## Concurrency and SSR

- Every method is synchronous, so no two can interleave.
- **It touches no browser API** — no storage, no timers, no `window`.
- `records` is `$state`, so the strip is deeply proxied. Records are readonly, so
  nothing is ever mutated in place and the proxy only ever sees the array change.

## Invariants

- **Ids are unique for the life of the instance.** The counter only advances.
- **`activate` never sets an id no tab answers to.** A click on a tab being
  closed in the same frame is a race, not a defect, and is ignored.
- **Nothing here is persisted.** Ids are per instance, so a stored one is
  meaningless on the next boot.

## File Tree

```text
tab-list/
├── tab-list.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
└── methods/
    ├── methods.md
    ├── mint.ts
    ├── add.ts
    ├── remove.ts
    └── activate.ts
```
